/* Phase 0 service worker: makes the app installable and the shell available offline.
 * Bump VERSION on every deploy that changes a precached file.
 * API calls are never cached here (offline data comes in Phase 9). */
const VERSION = "v2";
const SHELL_CACHE = `pls-shell-${VERSION}`;
const CDN_CACHE = `pls-cdn-${VERSION}`;
const CDN_HOSTS = ["cdn.jsdelivr.net"];

// <precache>
const PRECACHE = [
  "/app.html",
  "/assets/fonts/inter-latin-wght-normal.woff2",
  "/assets/icons/apple-touch-icon.png",
  "/assets/icons/favicon-32.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-maskable-512.png",
  "/auth.html",
  "/css/base.css",
  "/css/components.css",
  "/css/tokens.css",
  "/js/auth/auth.js",
  "/js/components/banner.js",
  "/js/components/bottom-sheet.js",
  "/js/components/nav.js",
  "/js/components/progress-ring.js",
  "/js/components/toast.js",
  "/js/core/api.js",
  "/js/core/config.js",
  "/js/core/offline.js",
  "/js/core/reminders.js",
  "/js/core/router.js",
  "/js/core/routes.js",
  "/js/core/session.js",
  "/js/core/store.js",
  "/js/core/supabase.js",
  "/js/core/theme.js",
  "/js/core/utils.js",
  "/js/features/analytics/view.js",
  "/js/features/dashboard/view.js",
  "/js/features/gallery/compress.js",
  "/js/features/gallery/view.js",
  "/js/features/goals/form.js",
  "/js/features/goals/row.js",
  "/js/features/goals/view.js",
  "/js/features/more/view.js",
  "/js/features/notes/editor.js",
  "/js/features/notes/view.js",
  "/js/features/planner/form.js",
  "/js/features/planner/view.js",
  "/js/features/settings/view.js",
  "/js/features/shared/coming-soon.js",
  "/js/main.js",
  "/manifest.webmanifest",
];
// </precache>

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, CDN_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page loads: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/app.html")));
    return;
  }
  // Own static files: serve cached copy instantly, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }
  // Versioned CDN assets (Bootstrap): cache first.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetchAndStore(req, CDN_CACHE)));
  }
  // Everything else (API, Supabase) goes straight to the network.
});

async function fetchAndStore(req, cacheName) {
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || refresh;
}
