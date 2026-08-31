"use client";

import { useState } from "react";
import LiveTrackingForm from "@/components/LiveTrackingForm";
import type { RouteGeoJSON, Vehicle } from "@/types/database";

export default function GefahrenSection({
  route,
  vehicles,
  personalBestSeconds,
}: {
  route: RouteGeoJSON;
  vehicles: Vehicle[];
  personalBestSeconds: number | null;
}) {
  // Standardmässig eingeklappt, damit die Seite beim blossen Ansehen einer
  // Strecke nicht durch ein immer offenes Formular überladen wirkt. Bleibt
  // nach dem Öffnen bewusst offen (kein Wieder-Einklappen), damit eine
  // laufende GPS-Aufzeichnung nie durch Unmounten unterbrochen werden kann —
  // "Zurück"/"Verwerfen" in LiveTrackingForm klappt über onExit wieder ein.
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-center border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-accent bg-accent px-10 py-3.5 text-base font-medium text-background transition-transform duration-fast active:scale-95 hover:opacity-90"
        >
          Strecke starten
        </button>
      </div>
    );
  }

  return (
    <LiveTrackingForm
      route={route}
      vehicles={vehicles}
      personalBestSeconds={personalBestSeconds}
      onExit={() => setOpen(false)}
    />
  );
}
