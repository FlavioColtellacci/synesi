/* global self, clients */
// Service worker for Web Push (VAPID). Payload is JSON: { title, body, url, tag }

self.addEventListener("push", (event) => {
  let payload = {
    title: "SYNESI",
    body: "You have a new alert.",
    url: "/app/convictions?panel=alerts",
    tag: "synesi-alert",
  }
  try {
    if (event.data) {
      const parsed = event.data.json()
      payload = { ...payload, ...parsed }
    }
  } catch {
    const text = event.data?.text?.() ?? ""
    if (text) {
      payload = { ...payload, body: text.slice(0, 180) }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon",
      badge: "/icon",
      tag: payload.tag || "synesi-alert",
      data: { url: payload.url || "/app/convictions?panel=alerts" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/app/convictions?panel=alerts"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const abs =
        url.startsWith("http") ? url : new URL(url, self.location.origin).href
      for (const client of windowClients) {
        if (client.url === abs && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(abs)
      }
      return undefined
    }),
  )
})
