self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = event.notification?.data?.url || "/";
  event.notification.close();
  event.waitUntil((async () => {
    const existingClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of existingClients) {
      if (client.url === targetUrl && "focus" in client) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
