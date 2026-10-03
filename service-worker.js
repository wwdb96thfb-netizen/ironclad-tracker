// Cache-first service worker: once the app has loaded one time with a
// connection, every file it needs (the page itself, its icons, its fonts)
// is cached, so future loads work with zero signal. Training data itself
// never touches this cache — that lives in localStorage, read directly by
// the page.
//
// VERSIONING: bump CACHE_NAME on every deploy that changes index.html,
// manifest.json or the icons. That's the only signal the browser has that
// anything changed — without it, already-installed copies keep serving the
// old cached files forever.
//
// A new version takes over automatically in the background as soon as it's
// done installing (self.skipWaiting() below) — that's safe here because
// this is a single-page app: nothing on screen changes mid-session just
// because the worker controlling future fetches changed. The page still
// shows an "update available" banner, but tapping it only needs to do a
// plain reload onto what's already cached — no message has to make it back
// to the worker first. (An earlier version waited for that round trip
// before switching over, which turned out to be unreliable in iOS Safari's
// "Add to Home Screen" standalone mode — the message to the waiting worker
// could silently never arrive, leaving the update stuck forever. This
// avoids that failure mode entirely.)
const CACHE_NAME = "ironclad-v21";
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
      .then(function () { return self.skipWaiting(); })
  );
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
