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
 *
 * "sentry" is in this list for the same reason, not a staff-route reason:
 * lib/errorTracking.ts loads @sentry/react via a dynamic import specifically
 * so a build with no DSN configured (true today) never makes a member
 * download it. That import carries a matching webpackChunkName. Without it
 * here too, the chunk would fall back to an unnamed numeric id, match
 * nothing below, and get precached onto every phone regardless of whether
 * error tracking is even turned on — silently defeating the point of
 * dynamic-importing it in the first place.
 *
 * Known limitation, accepted rather than fixed: filename matching cannot see
 * inside webpack's *shared* chunks. A module imported by both a staff route and
 * a member route (e.g. MemberDuesViewer/AddPaymentModal, currently bundled
 * together into a numeric-named chunk shared with a staff screen) keeps a
 * numeric name and is precached even though part of what it pulls in is
 * staff-adjacent. Splitting shared chunks out would need webpack config this
 * project is constrained from touching (no eject, no CRACO). Don't read the
 * absence of "admin"/"treasurer"/etc. in a chunk's name as proof it contains
 * nothing staff-related — it only proves it isn't *exclusively* a staff route.
 */
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) => !/(admin|treasurer|outreach|sms|sentry)/.test(entry.url))
);

// Navigations render from the precached shell, so a cold offline launch shows
// the app rather than the browser's error page.
//
// Workbox's NavigationRoute matches any request with `mode: 'navigate'` —
// that includes iframes and target="_blank" links, not just address-bar loads.
// This app serves real documents that way (see
// components/sections/WhatsHappeningSection.tsx: a teaching PDF in an
// <iframe>, and PDF/PPTX links opened with target="_blank" or download).
// Without a file-extension denylist, an installed worker would hand back the
// cached index.html for those requests instead of the actual document. CRA's
// own PWA template carries this same denylist for the same reason.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${process.env.PUBLIC_URL || ''}/index.html`), {
    denylist: [
      // Any URL that looks like a file, e.g. /docs/bylaws.pdf — the real guard.
      new RegExp('/[^/?]+\\.[^/]+$'),
      // Anything under a leading-underscore path (e.g. Firebase's /__/auth handlers).
      /^\/_/,
      // Cheap insurance, not a working guard today: the API lives on a
      // different origin, and Firebase Hosting's rewrite to index.html plus
      // NavigationRoute never writing to cache mean this never actually
      // triggers in the current deployment. Kept in case the API is ever
      // proxied same-origin.
      /^\/api\//,
    ],
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
