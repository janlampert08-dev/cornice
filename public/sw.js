// Minimaler Service Worker: sorgt nur dafür, dass die App bei fehlendem
// Netzwerk eine gebrandete Offline-Seite statt des nativen Browser-Fehlers
// zeigt, und dass statische Build-Assets aus dem Cache statt erneut vom
// Netz kommen. Bewusst kein Versuch, dynamische Seiten (Streckendetails,
// Profile, API-Routen) offline verfügbar zu machen — die brauchen
// Live-Daten/Auth, ein Cache davon wäre potenziell falsch oder stale.
const CACHE_NAME = "cornice-shell-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (Seitenaufruf): Netz zuerst, damit Nutzer immer die aktuelle,
  // authentifizierte Seite sehen — nur bei Netzwerkfehler auf die gecachte
  // Offline-Seite zurückfallen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
    );
    return;
  }

  // Fingerprinted Build-Assets ändern sich nie unter derselben URL —
  // cache-first ist hier sicher und spart wiederholte Netzwerk-Requests.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});
