/* =========================================================
   Backstage Loops & Play : service worker (appli installable)
   ---------------------------------------------------------
   Pose le 26/09/2026. Volontairement prudent :
   - les pages passent toujours par le reseau (jamais une vieille
     version apres un deploiement) ; hors connexion, on affiche la
     derniere page connue ;
   - seuls les fichiers a empreinte (assets/index-XXXX.js) et les icones
     sont gardes en cache, puisqu'ils ne changent jamais de contenu ;
   - Supabase et les scripts PHP ne passent jamais par le cache.
   Il prepare aussi les notifications (evenements push et clic).
   ========================================================= */

const VERSION = 'lp-backstage-v1'
const CACHE = VERSION + '-statique'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cles = await caches.keys()
    await Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/backstage/')) return
  if (url.pathname.startsWith('/backstage/api/')) return

  // Pages de l'appli : reseau d'abord, derniere copie si hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const rep = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put('/backstage/index.html', rep.clone())
        return rep
      } catch {
        const copie = await caches.match('/backstage/index.html')
        return copie || new Response('<h1 style="font-family:sans-serif">Pas de connexion</h1><p>Reconnecte-toi pour ouvrir le Backstage.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
    })())
    return
  }

  // Fichiers a empreinte et icones : cache d'abord.
  if (/\/backstage\/(assets|icons)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const en = await cache.match(req)
      if (en) return en
      const rep = await fetch(req)
      if (rep.ok) cache.put(req, rep.clone())
      return rep
    })())
  }
})

/* ---------- Notifications ---------- */

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { corps: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.titre || 'Loops & Play', {
    body: d.corps || 'Du nouveau dans ton Backstage.',
    icon: '/backstage/icons/icon-192.png',
    badge: '/backstage/icons/icon-192.png',
    tag: d.tag || 'lp',
    renotify: true,
    data: { url: d.url || '/backstage/communaute' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const cible = new URL(e.notification.data?.url || '/backstage/', self.location.origin).href
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const f of fenetres) {
      if (f.url.startsWith(self.location.origin + '/backstage/')) {
        await f.focus()
        if ('navigate' in f) return f.navigate(cible)
        return
      }
    }
    return self.clients.openWindow(cible)
  })())
})
