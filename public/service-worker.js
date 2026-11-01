const CACHE_NAME = 'trading-new-shell-v5';

const BYPASS_PATTERNS = [
  '/api/',
  'binance.com',
  'binance.vision',
  'yahoo.com',
  'entrade.com.vn',
  'vndirect.com.vn',
  'simplize.vn',
  'ssi.com.vn',
  'stlouisfed.org',
  'newyorkfed.org',
  'alternative.me',
  'cryptocompare.com',
  'googleapis.com',
  'telegram.org',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url || '';
  if (!url.startsWith('http') || BYPASS_PATTERNS.some((pat) => url.includes(pat))) {
    // Strictly never intercept or cache real-time market/macro API calls
    return;
  }

  // Network-first for static app shell assets (HTML/JS/CSS) with offline fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});
