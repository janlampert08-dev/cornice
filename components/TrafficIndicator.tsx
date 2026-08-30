"use client";

import { CONGESTION_META, type CongestionLevel } from "@/lib/traffic";

export type TrafficChipState = "loading" | "none" | CongestionLevel;

// Rein darstellend: Datenabfrage und Kartenanzeige liegen bei RouteDetailMap
// (einzige Quelle für beides, siehe lib/traffic.ts) — der Chip zeigt nur den
// aktuellen Zustand und schaltet bei Klick dieselbe eingefärbte Strecke auf
// der (ohnehin sichtbaren) Karte um, statt eine eigene, unverbundene
// Textzeile zu sein.
export default function TrafficIndicator({
  state,
  active,
  onToggle,
}: {
  state: TrafficChipState;
  active: boolean;
  onToggle: () => void;
}) {
  if (state === "loading") {
    return (
      <span className="flex items-center gap-2 rounded-xl border border-[#131316]/15 shadow-sm bg-[#FAFAFA] px-3 py-1.5 text-sm text-[#8A8F98]">
        <span className="h-2 w-2 animate-pulse bg-[#8A8F98]/40" />
        Verkehr wird geladen…
      </span>
    );
  }

  if (state === "none") {
    return (
      <span className="flex items-center gap-2 rounded-xl border border-[#131316]/15 shadow-sm bg-[#FAFAFA] px-3 py-1.5 text-sm text-[#8A8F98]">
        <span className="h-2 w-2 bg-[#8A8F98]/40" />
        Keine Live-Verkehrsdaten
      </span>
    );
  }

  const meta = CONGESTION_META[state];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? "Verkehr auf der Karte ausblenden" : "Verkehr auf der Karte anzeigen"}
      className={
        active
          ? "flex items-center gap-2 rounded-full border border-[#131316] bg-[#131316] shadow-sm transition-transform active:scale-95 px-3 py-1.5 text-sm font-medium text-[#FAFAFA]"
          : "flex items-center gap-2 border border-[#131316] bg-[#FAFAFA] px-3 py-1.5 text-sm font-medium text-[#131316] hover:bg-[#131316] hover:text-[#FAFAFA]"
      }
    >
      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: meta.color }} />
      Verkehr: {meta.label}
    </button>
  );
}
