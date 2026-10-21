/**
 * Service Worker para Horário Escolar 2026
 * Fornece funcionamento 100% offline, carregamento instantâneo via cache local
 * e suporte a Progressive Web App (PWA) instalável.
 */

const CACHE_NAME = 'horario-escola-v2026-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './eaba.png',
  './logo_batatais.png',
  './secretaria.png'
];

// Instalação do Service Worker e pré-cache de ativos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de versões antigas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia Stale-While-Revalidate para requisições
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Requisições para a mesma origem (assets locais)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Se falhar e não houver cache, tenta index.html para navegações
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });

        // Retorna a resposta do cache imediatamente se existir, ou aguarda o fetch
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Requisições externas (como Google Fonts)
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
  }
});
