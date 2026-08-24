const CACHE_NAME = "cuaderno-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
