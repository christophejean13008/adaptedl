/* Adaptedl — mise en cache pour l'usage hors ligne */
const CACHE = 'adaptedl-v1';
const ESSENTIELS = [
  './', './index.html', './analyse.js', './manifest.webmanifest',
  './vendor/tesseract.min.js', './vendor/worker.min.js',
  './vendor/tesseract-core-simd-lstm.wasm.js', './vendor/tesseract-core-lstm.wasm.js',
  './vendor/fra.traineddata',
  './vendor/pdf.min.js', './vendor/pdf.worker.min.js'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ESSENTIELS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  // le script de l'IA est distant : jamais mis en cache, jamais bloquant
  if(new URL(e.request.url).origin!==location.origin) return;
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).then(rep=>{
      if(rep.ok && new URL(e.request.url).origin===location.origin)
        caches.open(CACHE).then(c=>c.put(e.request, rep.clone()));
      return rep;
    }).catch(()=>r))
  );
});
