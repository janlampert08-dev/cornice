"use client";

import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import {
  getOfflineRoute,
  isIndexedDbAvailable,
  removeOfflineRoute,
  saveOfflineRoute,
  type OfflineRoute,
} from "@/lib/offlineRoutes";
import { buttonVariants } from "@/components/ui/Button";

// route wird bereits fertig auf das schlanke OfflineRoute-Shape reduziert
// von der Seite übergeben (app/strecken/[id]/page.tsx) — eine reine
// Server→Client-Datenprop, keine Funktion, also unproblematisch über die
// Komponentengrenze serialisierbar.
export default function OfflineRouteButton({ route }: { route: OfflineRoute }) {
  // null = noch nicht geprüft (IndexedDB-Zugriff ist async) — erst danach
  // wird der Button gerendert, damit er nicht kurz im falschen Zustand
  // aufblitzt. Lazy-Initializer statt Effekt für den "nicht verfügbar"-Fall,
  // damit der Effekt selbst keinen synchronen setState-Aufruf mehr braucht
  // (nur noch in den .then()/.catch()-Callbacks, siehe unten).
  const [saved, setSaved] = useState<boolean | null>(() => (isIndexedDbAvailable() ? null : false));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isIndexedDbAvailable()) return;
    getOfflineRoute(route.id)
      .then((existing) => setSaved(existing !== null))
      .catch(() => setSaved(false));
  }, [route.id]);

  if (!isIndexedDbAvailable() || saved === null) return null;

  async function toggle() {
    setPending(true);
    try {
      if (saved) {
        await removeOfflineRoute(route.id);
        setSaved(false);
      } else {
        await saveOfflineRoute(route);
        setSaved(true);
      }
    } catch {
      // Speicher voll o.ä. — Zustand unverändert lassen, Button bleibt
      // bedienbar für einen erneuten Versuch.
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className={buttonVariants({ variant: "secondary", size: "sm" })}
    >
      {saved ? (
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {saved ? "Offline entfernen" : "Offline download"}
    </button>
  );
}
