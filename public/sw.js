const CACHE_NAME = 'merlux-chauffeur-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/favicon.ico',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to check if request is a static asset
function isStaticAsset(url) {
  const extensionRegex = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|json)$/i;
  return extensionRegex.test(url.pathname) || 
         url.host.includes('fonts.googleapis.com') || 
         url.host.includes('fonts.gstatic.com');
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bypass chrome extensions or non-http protocols
  if (!request.url.startsWith('http')) return;

  // For POST/PUT or other non-GET requests, forward directly to network
  if (request.method !== 'GET') return;

  // Offline-first logic
  if (isStaticAsset(url)) {
    // Cache-first (with Network fallback and update)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Silently absorb fetch errors for static assets if already cached
          });

          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Network-first (with Cache Fallback for documents and API responses)
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // If valid response, cache it for offline use (especially navigation routes)
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache if network fails (offline navigation/APIs)
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If main page navigation, try matching '/')
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response(
              JSON.stringify({ error: 'Offline, no cached data available.' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
  }
});
