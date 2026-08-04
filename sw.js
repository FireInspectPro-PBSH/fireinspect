/* ============================================================
   FireInspect Pro — Service Worker
   ============================================================
   Permite que la app funcione sin conexión a internet una vez
   instalada: guarda en caché los archivos propios de la app y
   las librerías externas (Chart.js, jsPDF, íconos), para que un
   inspector pueda trabajar en un edificio sin señal.
   ============================================================ */

const CACHE_NAME = 'fireinspect-cache-v29';

const ARCHIVOS_PARA_CACHEAR = [
  './',
  './index.html',
  './manifest.json',
  './css/estilos.css',
  './js/db.js',
  './js/auth.js',
  './js/nfpa25-modelo.js',
  './js/equipos.js',
  './js/unidades.js',
  './js/curva-desempeno.js',
  './js/incidentes.js',
  './js/hallazgos-auditoria.js',
  './js/planes-accion.js',
  './js/fotos.js',
  './js/firma.js',
  './js/pdf-generator.js',
  './js/ui.js',
  './js/ui-inspeccion.js',
  './js/ui-reportes.js',
  './js/ui-seguimiento.js',
  './js/ui-curva-desempeno.js',
  './js/app.js',
  './vendor/chartjs/chart.umd.js',
  './vendor/jspdf/jspdf.umd.min.js',
  './vendor/tabler-icons/tabler-icons.min.css',
  './vendor/tabler-icons/fonts/tabler-icons.woff2',
  './vendor/tabler-icons/fonts/tabler-icons.woff',
  './vendor/tabler-icons/fonts/tabler-icons.ttf',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ARCHIVOS_PARA_CACHEAR.map((url) =>
          cache.add(url).catch(() => {
            // si un recurso externo falla (ej. sin internet en la primera instalación),
            // no rompe el resto del cacheo
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

/* Estrategia: "cache first, network fallback" — prioriza velocidad
   y funcionamiento offline; si el archivo no está en caché, lo busca
   en la red y lo guarda para la próxima vez */
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request).then((respuestaCacheada) => {
      if (respuestaCacheada) return respuestaCacheada;

      return fetch(evento.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => {
          if (evento.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
