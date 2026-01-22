
const CACHE_NAME = 'buon-umore-v2';

// Asset critici per far apparire l'interfaccia base
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn-icons-png.flaticon.com/512/869/869869.png'
];

// Installazione: salviamo il guscio dell'app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Forza l'attivazione immediata della nuova versione
});

// Pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Non intercettiamo le chiamate API di Google o Supabase per evitare blocchi
  if (event.request.url.includes('google') || event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Restituiamo la versione in cache ma aggiorniamola in background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        });
        return cachedResponse;
      }

      // Se non è in cache, lo prendiamo dalla rete
      return fetch(event.request).then((networkResponse) => {
        // Se è un file CSS, JS o un'immagine da un CDN affidabile, salviamolo per il futuro
        if (networkResponse && networkResponse.status === 200 && 
           (event.request.url.includes('cdn') || event.request.url.includes('fonts'))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // Fallback estremo: se sei totalmente offline e il file non c'è, restituisci l'index
      if (event.request.mode === 'navigate') {
        return caches.match('/');
      }
    })
  );
});
