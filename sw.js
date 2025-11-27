const CACHE_NAME = 'trek-tracker-v1';

// 1. ไฟล์พื้นฐานที่ต้องโหลดเก็บไว้ทันที (App Shell)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './attachment_147008007.png',
  './midnight-glow-over-peaks.3840x2160.jpg',
  
  // Libraries ภายนอก (เก็บไว้ด้วย เผื่อเน็ตหลุด)
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;800&display=swap'
];

// --- 1. INSTALL: ติดตั้งและ Cache ไฟล์พื้นฐาน ---
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // บังคับให้ SW ตัวใหม่ทำงานทันที
});

// --- 2. ACTIVATE: เคลียร์ Cache เก่าเมื่ออัปเดต ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// --- 3. FETCH: ดึงข้อมูล (หัวใจสำคัญของ Offline Mode) ---
self.addEventListener('fetch', (event) => {
  
  // ถ้าเป็นการส่งข้อมูล (POST) เช่น กด Save ให้ข้ามไป (ปล่อยให้โค้ดใน index.html จัดการ)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 3.1 ถ้ามีของใน Cache เอามาใช้เลย (Offline ใช้ได้ทันที)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 3.2 ถ้าไม่มี ให้วิ่งไปโหลดจากเน็ต
      return fetch(event.request).then((networkResponse) => {
        // เช็คว่าโหลดสำเร็จไหม
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          // ถ้าเป็น Map Tiles (OpenStreetMap) หรือรูปภาพภายนอก ให้ยอมรับ type 'opaque' ได้
          if (!event.request.url.includes('tile.openstreetmap.org') && !event.request.url.includes('googleusercontent')) {
              return networkResponse;
          }
        }

        // 3.3 โหลดเสร็จแล้ว "แอบเก็บลง Cache" ด้วย (Dynamic Caching)
        // ครั้งหน้าเปิดมาจะได้ไม่ต้องโหลดใหม่ (รวมถึงแผนที่ที่เคยเปิดดูแล้วด้วย)
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // กรณีเน็ตหลุดและหาใน Cache ไม่เจอ
        console.log('Offline and resource not found');
      });
    })
  );
});