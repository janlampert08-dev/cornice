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

// Schlüssel je Aufzeichnung: bei einer Streckenfahrt die Strecken-ID, bei
// einer freien Fahrt der feste Wert FREE_RIDE_STORAGE_KEY — so überschreiben
// sich die beiden Arten nicht gegenseitig.
export const FREE_RIDE_STORAGE_KEY = "frei";

function key(storageKey: string): string {
  return `cornice:tracking:${storageKey}`;
}

// Absichtlich fehlertolerant statt die Aufzeichnung daran scheitern zu
// lassen: localStorage kann in Private-Browsing-Kontexten oder bei vollem
// Speicher werfen — Tracking soll auch dann weiterlaufen, nur ohne
// Crash-Wiederherstellung.
export function saveTrackingSnapshot(storageKey: string, snapshot: TrackingSnapshot): void {
  try {
    localStorage.setItem(key(storageKey), JSON.stringify(snapshot));
  } catch {
    // Speichern übersprungen — Aufzeichnung läuft im Speicher trotzdem weiter.
  }
}

export function loadTrackingSnapshot(storageKey: string): TrackingSnapshot | null {
  try {
    const raw = localStorage.getItem(key(storageKey));
    if (!raw) return null;
    return JSON.parse(raw) as TrackingSnapshot;
  } catch {
    return null;
  }
}

export function clearTrackingSnapshot(storageKey: string): void {
  try {
    localStorage.removeItem(key(storageKey));
  } catch {
    // Nichts zu tun — beim nächsten Start wird ein veralteter Snapshot
    // ohnehin durch einen neuen überschrieben.
  }
}
