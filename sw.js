/* Adaptedl — cache hors ligne.
   vendor/ : cache d'abord (ne change jamais).
   application : réseau d'abord, pour qu'une mise à jour arrive tout de suite. */
const CACHE='adaptedl-v25';
const MOTEUR=['./vendor/pdf.min.js','./vendor/pdf.worker.min.js'];
const APPLI=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE)
    .then(c=>Promise.allSettled([...MOTEUR,...APPLI].map(u=>c.add(u))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;                 // le relais passe en POST
  const u=new URL(e.request.url);
  if(u.origin!==location.origin) return;               // relais : jamais intercepté
  if(u.pathname.includes('/vendor/')){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(rep=>{
      if(rep.ok) caches.open(CACHE).then(c=>c.put(e.request,rep.clone()));
      return rep; })));
    return;
  }
  e.respondWith(fetch(e.request).then(rep=>{
if(rep.ok) caches.open(CACHE).then(c=>c.put(e.request,rep.clone()));
    return rep;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
