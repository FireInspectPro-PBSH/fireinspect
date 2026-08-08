// Service Worker v51 — limpio
// Actualizado: 2026-08-08

const CACHE_NAME = 'fireinspect-cache-v51';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Sin caché — siempre va a la red
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
