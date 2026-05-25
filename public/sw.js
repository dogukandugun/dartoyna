const CACHE = 'dartoyna-v5';
const SHELL = ['/', '/style.css', '/app.js', '/checkouts.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/socket.io/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() =>
      new Response('<h2 style="font-family:sans-serif;padding:2rem">İnternet bağlantısı gerekli</h2>',
        { headers: { 'Content-Type': 'text/html' } })
    ))
  );
});
