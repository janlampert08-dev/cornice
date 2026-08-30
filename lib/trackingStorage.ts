import type { TrailPoint } from "@/lib/geo";

export interface TrackingSnapshot {
  phase: "tracking" | "finished";
  trail: TrailPoint[];
  distanceKm: number;
  hasStarted: boolean;
  hasLeftStart: boolean;
  startTimeMs: number | null;
  savedAt: number;
  // Nur gesetzt, wenn phase === "finished" — die beim Stoppen final
  // berechnete Fahrzeit (siehe handleStop in LiveTrackingForm.tsx). Für
  // "tracking" wird die verstrichene Zeit beim Wiederaufnehmen stattdessen
  // live aus startTimeMs neu berechnet.
  seconds: number | null;
}

function key(routeId: string): string {
  return `cornice:tracking:${routeId}`;
}

// Absichtlich fehlertolerant statt die Aufzeichnung daran scheitern zu
// lassen: localStorage kann in Private-Browsing-Kontexten oder bei vollem
// Speicher werfen — Tracking soll auch dann weiterlaufen, nur ohne
// Crash-Wiederherstellung.
export function saveTrackingSnapshot(routeId: string, snapshot: TrackingSnapshot): void {
  try {
    localStorage.setItem(key(routeId), JSON.stringify(snapshot));
  } catch {
    // Speichern übersprungen — Aufzeichnung läuft im Speicher trotzdem weiter.
  }
}

export function loadTrackingSnapshot(routeId: string): TrackingSnapshot | null {
  try {
    const raw = localStorage.getItem(key(routeId));
    if (!raw) return null;
    return JSON.parse(raw) as TrackingSnapshot;
  } catch {
    return null;
  }
}

export function clearTrackingSnapshot(routeId: string): void {
  try {
    localStorage.removeItem(key(routeId));
  } catch {
    // Nichts zu tun — beim nächsten Start wird ein veralteter Snapshot
    // ohnehin durch einen neuen überschrieben.
  }
}
