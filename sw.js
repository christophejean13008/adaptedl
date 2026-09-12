/* Adaptedl — cache hors ligne.
   Le moteur (vendor/) : cache d'abord, il ne change jamais et pèse 10 Mo.
   L'application : réseau d'abord, pour qu'une mise à jour arrive tout de suite. */
const CACHE = 'adaptedl-v4';
const MOTEUR = [
  './vendor/tesseract.min.js', './vendor/worker.min.js',
  './vendor/tesseract-core-simd-lstm.wasm.js', './vendor/tesseract-core-lstm.wasm.js',
  './vendor/fra.traineddata',
  './vendor/pdf.min.js', './vendor/pdf.worker.min.js'
];
const APPLI = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE)
    .then(c=>c.addAll(MOTEUR).then(()=>c.addAll(APPLI).catch(()=>{})))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;

  if(url.pathname.includes('/vendor/')){          // moteur : cache d'abord
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).then(rep=>{
      if(rep.ok) caches.open(CACHE).then(c=>c.put(e.request, rep.clone()));
      return rep;
    })));
    return;
  }
  e.respondWith(                                   // application : réseau d'abord
    fetch(e.request).then(rep=>{
      if(rep.ok) caches.open(CACHE).then(c=>c.put(e.request, rep.clone()));
      return rep;
    }).catch(()=> caches.match(e.request).then(r=> r || caches.match('./index.html')))
  );
});
