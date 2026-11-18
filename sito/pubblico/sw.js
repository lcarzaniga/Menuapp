// Sostituisce un eventuale service worker installato in passato su questo indirizzo: si
// toglie, svuota le cache e ricarica le pagine aperte.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) await caches.delete(nome)
      await self.registration.unregister()
      for (const finestra of await self.clients.matchAll({ type: 'window' })) finestra.navigate(finestra.url)
    })(),
  )
})
