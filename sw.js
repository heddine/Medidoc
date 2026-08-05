// Service Worker MediDoc — mise en cache pour usage hors-ligne
// v2 : passage en stratégie "réseau d'abord" pour index.html, afin que
// chaque nouveau déploiement soit pris en compte immédiatement au lieu de
// rester bloqué sur une ancienne version mise en cache.
const CACHE_NAME = 'medidoc-v2';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
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
  // Les appels à la fonction de classification ne doivent jamais être mis en cache
  if (event.request.url.includes('/.netlify/functions/')) return;

  const estPageOuScript = event.request.mode === 'navigate' ||
    event.request.url.endsWith('/index.html') ||
    event.request.url.endsWith('.js') ||
    event.request.url.endsWith('/');

  if (estPageOuScript) {
    // Réseau d'abord : on tente toujours de récupérer la dernière version en
    // ligne en priorité ; le cache ne sert que si le réseau est indisponible
    // (mode hors-ligne), et est rafraîchi à chaque succès réseau.
    event.respondWith(
      fetch(event.request)
        .then(reponse => {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copie));
          return reponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Autres ressources (images, polices...) : cache d'abord, réseau en repli
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => cached))
  );
});
