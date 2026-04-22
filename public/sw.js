// StudyLog Service Worker — offline shell caching
// Bump CACHE_NAME when deploying breaking changes to force a cache refresh
const CACHE_NAME = 'studylog-shell-v1'

// Seed the cache with the app shell on first install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/', '/manifest.json']))
  )
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting()
})

// Remove stale caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Let cross-origin requests (Supabase API, CDNs) pass through untouched
  if (url.origin !== self.location.origin) return

  // Navigation requests (HTML): network-first so the app shell stays fresh.
  // Fall back to the cached shell when offline — keeps the SPA bootable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache a fresh copy of the shell on each successful load
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put('/', clone))
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Static assets (JS, CSS, fonts, images): cache-first.
  // Vite uses content-hashed filenames so cached files are always valid.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        // Only cache successful same-origin responses
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
        }
        return response
      })
    })
  )
})
