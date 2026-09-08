const CACHE_NAME = 'trading-new-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through live API requests
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('binance') ||
    event.request.url.includes('yahoo') ||
    event.request.url.includes('ssi.com.vn') ||
    event.request.url.includes('googleapis') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network First for all HTML, JS, CSS, and navigation requests
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
