/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { isCacheableApiRequestSafe } from './sw/cachePolicy';

clientsClaim();

/**
 * CRA's generated manifest lists every code-split chunk, including the admin
 * and treasurer bundles that commit f9cc6b5 deliberately split out of the
 * initial download. Precaching all of it would hand every member the
 * treasurer's bundle again. Those chunks stay lazy and are fetched only if
 * somebody actually navigates to them.
 *
 * This match only works because the five staff-only lazy() imports in
 * App.tsx (AdminDashboard, TreasurerDashboard, OutreachDashboard, SmsBroadcast,
 * VoicemailInbox) carry an explicit webpackChunkName containing one of these
 * substrings. Webpack's default production chunk names are hashed numeric ids
 * unrelated to the source path (e.g. "172.fa105aaf.chunk.js"), so an unnamed
 * staff route's chunk would match nothing here and get precached onto every
 * member's phone. Verify with a real build after touching either file —
 * `grep` the source for these words proves nothing; only inspecting the
 * compiled manifest in build/service-worker.js does.
 */
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) => !/(admin|treasurer|outreach|sms)/.test(entry.url))
);

// Navigations render from the precached shell, so a cold offline launch shows
// the app rather than the browser's error page.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${process.env.PUBLIC_URL || ''}/index.html`), {
    denylist: [/^\/api\//],
  })
);

// The single allowlisted API response. Everything else falls through to the
// NetworkOnly rule below.
registerRoute(
  ({ request }) => isCacheableApiRequestSafe(request),
  new StaleWhileRevalidate({
    cacheName: 'parish-announcements',
    plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 })],
  })
);

// Explicit: any other API request, including every authenticated one, never
// touches CacheStorage.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// The page asks for the takeover; the worker never forces it.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
