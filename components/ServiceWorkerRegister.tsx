"use client";

import { useEffect } from "react";

// Nur in Produktion registrieren — in der Entwicklung (next dev/Turbopack)
// würde ein Service Worker eigene, potenziell veraltete Caches von Build-
// Assets anlegen und mit dem Hot-Module-Reloading kollidieren.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keine Fehlerbehandlung nötig — ohne Service Worker läuft die App
      // einfach ohne die Offline-Fallback-Seite/Asset-Cache weiter.
    });
  }, []);

  return null;
}
