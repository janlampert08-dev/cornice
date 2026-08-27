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
      <div className="flex flex-col items-center gap-2 border-t border-[#131316]/10 pt-6 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-[#131316] bg-[#131316] px-10 py-3.5 text-base font-medium text-[#FAFAFA] hover:opacity-90"
        >
          Strecke starten
        </button>
        <p className="max-w-xs text-xs text-[#8A8F98]">
          Fahr nur so schnell, wie es sicher und erlaubt ist. Nutzt den Standort deines
          Browsers — der Tab muss während der Fahrt geöffnet bleiben.
        </p>
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
