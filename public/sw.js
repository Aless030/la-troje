// Service worker de La Troje: permite instalar la app y abrirla rápido.
// Los datos (ventas, inventario…) siempre vienen en vivo de Firebase; aquí solo se guarda
// la "carcasa" de la app (pantallas, estilos, íconos) para que abra aunque la señal sea mala.
const VERSION = "la-troje-v1";
const BASE = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, fuentes, etc.: directo a la red

  // Pantallas: primero la red (así siempre se ve la última versión); sin internet, la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(VERSION).then((c) => c.put("/index.html", copia));
      return r;
    }).catch(() => caches.match("/index.html")));
    return;
  }

  // Archivos de la app (js, css, imágenes): los de /assets/ cambian de nombre en cada versión, se guardan al verlos.
  e.respondWith(
    caches.match(req).then((guardado) => {
      const red = fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(req, copia)); }
        return r;
      }).catch(() => guardado);
      return guardado || red;
    })
  );
});
