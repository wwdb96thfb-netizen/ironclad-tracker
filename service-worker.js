// Cache-first service worker: once the app has loaded one time with a
// connection, every file it needs (the page itself, its icons, its fonts)
// is cached, so future loads work with zero signal. Training data itself
// never touches this cache — that lives in localStorage, read directly by
// the page.
//
// VERSIONING: bump CACHE_NAME on every deploy that changes index.html,
// manifest.json or the icons. That's the only signal the browser has that
// anything changed — without it, already-installed copies keep serving the
// old cached files forever. A new version installs in the background and
// sits "waiting" (see below) until the page asks it to take over, so a
// visit in progress never gets swapped out from under the user.
const CACHE_NAME = "ironclad-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
    // No self.skipWaiting() here on purpose: a freshly installed worker
    // stays in the "waiting" state so the page can show an "update
    // available" prompt and only switch over once the user taps it.
  );
});

// The page posts this once the user confirms the update prompt.
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Offline and not cached — nothing more we can do for this request.
        return cached;
      });
    })
  );
});
