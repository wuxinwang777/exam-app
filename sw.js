const CACHE_NAME = 'c3-quiz-v3';  // 更新版本号强制刷新缓存
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './qbank.json'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first for qbank.json, cache-first for other assets
self.addEventListener('fetch', event => {
  // Skip non-GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isQbank = url.pathname.endsWith('qbank.json');

  // For qbank.json, always use network-first to get latest data
  if (isQbank) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => null);

      // For navigation requests (HTML pages), prefer network
      if (event.request.mode === 'navigate') {
        return networkFetch || cached || caches.match('./index.html');
      }

      // For other assets, try cache first then network
      return cached || networkFetch;
    })
  );
});

// 强制清理旧缓存（v1 有 bug，需要彻底清除）
self.addEventListener('message', event => {
  if (event.data === 'clear-cache') {
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      event.ports[0].postMessage('cache-cleared');
    });
  }
});
