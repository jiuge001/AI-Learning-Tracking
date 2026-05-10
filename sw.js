const CACHE_VERSION = 'learn-track-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/data-manager.js',
  './js/chart-renderer.js',
  './js/ocr-helper.js',
  './js/grader.js',
  './js/app.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 网络优先策略：优先从网络获取，离线时回退到缓存
self.addEventListener('fetch', e => {
  // 跳过非GET请求和API调用
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // 网络请求成功，更新缓存
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => {
        // 网络失败，尝试从缓存返回
        return caches.match(e.request);
      })
  );
});
