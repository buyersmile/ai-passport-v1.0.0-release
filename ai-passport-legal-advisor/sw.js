const CACHE_NAME = 'legal-live-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ติดตั้ง Service Worker และแคชไฟล์พื้นฐาน
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// ดึงข้อมูลจากแคชเมื่อออฟไลน์
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});