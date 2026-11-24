/* LOU LOU Kasse — офлайн-кэш. Страница: сначала сеть (чтобы приходили обновления), без сети — из кэша.
   Библиотеки и значки: из кэша. Запросы к Google и Firebase не перехватываются. */
var V = 'kasse-2a31f18e0e', FILES = ["./", "index.html", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js", "vendor/firebase-firestore-compat.js", "vendor/jspdf.umd.min.js", "vendor/jszip.min.js"];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('kasse-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  var page = e.request.mode === 'navigate' || /\/(index\.html|config\.js)?$/.test(u.pathname);
  if (page) {
    e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(V).then(function (k) { k.put(e.request, c); }); return r; })
      .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
