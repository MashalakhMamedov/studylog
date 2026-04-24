const CACHE_NAME = 'studylog-v5';

const PRECACHE_ASSETS = [
  '/manifest.json',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/splash/splash-640x1136.png',
  '/splash/splash-750x1334.png',
  '/splash/splash-1242x2208.png',
  '/splash/splash-1125x2436.png',
  '/splash/splash-828x1792.png',
  '/splash/splash-1170x2532.png',
  '/splash/splash-1284x2778.png',
  '/splash/splash-1179x2556.png',
  '/splash/splash-1290x2796.png',
  '/splash/splash-1536x2048.png',
  '/splash/splash-1668x2388.png',
  '/splash/splash-2048x2732.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
