const CACHE_NAME = "cuaderno-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Red primero (datos financieros siempre frescos), y si no hay red, sirve
// la última versión en caché. Chrome exige un service worker con "fetch"
// registrado para ofrecer el instalable de la PWA.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Muestra la notificación cuando llega un push del servidor.
self.addEventListener("push", (event) => {
  let data = { title: "Cuaderno", body: "Tienes un pago pendiente." };
  try {
    data = event.data.json();
  } catch (e) {
    // usa el valor por defecto si no llega JSON
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
