# Rolling back the PWA / service worker

Shipped in `df904c2` (merge of `feat/mobile-shell-pwa`), 8 Aug 2026.

## Read this first

**Reverting the merge does not remove the service worker from a member's phone.**

Once a browser has registered a service worker, that registration lives on the device.
Deleting `frontend/src/service-worker.js` and deploying only means the browser's periodic
update check fetches a URL that 404s — a failed fetch during an update check leaves the
**existing worker installed and active**. It does not unregister anything.

A plain revert is in fact worse than doing nothing, because it produces this state:

- The member's device still serves the precached v1 app shell (`index.html`).
- The server no longer has v1's hashed JS chunks, because the revert rebuilt everything.
- So the member is pinned to a shell whose chunks 404. Firebase Hosting rewrites `**` to
  `/index.html`, so those requests return HTML with a 200, which surfaces as
  `ChunkLoadError`.

`lazyWithRecovery` and the `ErrorBoundary` above the route tree keep that from being a
blank page, but the member is stuck until a real worker replaces the old one.

## The actual rollback

Deploy a worker that unregisters itself. Keep the file at the **same URL** the old worker
was registered from, `/service-worker.js`, or the browser will never fetch it.

Replace the contents of `frontend/src/service-worker.js` with:

```js
/* eslint-disable no-restricted-globals */

// Kill switch. Replaces the real worker at the same URL so browsers fetch it on
// their next update check, then removes itself and drops every cache it created.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
```

Then deploy. Do **not** also delete the file — the whole point is that it must be served.

### What members experience

- The browser checks for a worker update on navigation, and at most every 24 hours.
- On that check it fetches the kill switch, installs it, and `skipWaiting()` activates it
  immediately.
- Activation clears every cache, unregisters, and reloads open tabs onto the live network
  version.
- **No user action is required.** A member does not need to tap Refresh, and the update
  toast is not involved — that toast only exists in the app's own JavaScript, so it is not
  the escape hatch if the shell itself is broken.
- A member who never reopens the app keeps the old worker until they do.

### If the app shell renders blank

`useServiceWorker` lives in the app's JavaScript. If the shell fails to render, that hook
never runs, so nothing in the UI can help. The recovery is to fully close the app (or the
tab) and reopen it, which triggers a navigation and therefore an update check. On an
installed PWA there is no address bar, so "close and reopen the app" is the instruction to
give people.

## Leaving the kill switch in place

Once every device has picked it up, you can remove `service-worker.js` entirely. There is
no reliable signal for when that has happened. Leaving the kill switch deployed
indefinitely is harmless — it costs one small fetch per update check — so there is no
pressure to clean it up quickly.

## Rolling forward instead

If the problem is a bug in the app rather than in the service-worker strategy, prefer a
normal fix-and-deploy. The update flow is designed for exactly this: a new worker installs
and waits, the member sees "A new version is available" with a Refresh button, and nobody
is swapped out mid-payment. `lazyWithRecovery` additionally forces an update check when a
stale chunk fails, so members on an old shell are pulled forward without tapping anything.

## Related

- `frontend/src/service-worker.js` — the real worker (precache filter, allowlist routing)
- `frontend/src/sw/cachePolicy.ts` — what may be cached; allowlist, fails closed
- `frontend/src/utils/lazyWithRecovery.ts` — post-deploy chunk recovery
- `docs/superpowers/plans/2026-08-07-mobile-shell-pwa-verification.md` — what was verified,
  and what still needs a human on real hardware
