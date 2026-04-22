// Service Worker para Horário Escolar PWA
// Cache essencial para offline + atualizações inteligentes

const CACHE_NAME = 'horario-escolar-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/TODO.md'
];

// Instalação: Cacheia arquivos essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Estratégia Network First com fallback cache + stale-while-revalidate
self.addEventListener('fetch', event => {
  // Ignora requisições não-HTTP e fonts externas
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    // Tenta network first
    fetch(event.request).then(response => {
      // Clona para cachear resposta bem-sucedida
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, responseClone);
      });
      return response;
    }).catch(() => {
      // Fallback para cache se offline
      return caches.match(event.request)
        .then(cachedResponse => cachedResponse || 
          // Fallback página offline customizada para HTML
          (event.request.destination === 'document' ? 
            caches.match('/index.html') : null)
        );
    })
  );
});

// Push notifications (futuro)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

