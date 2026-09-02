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

// Der Schlüssel enthält die Nutzer-ID. Ohne sie teilen sich alle Konten auf
// demselben Browser denselben Eintrag: wer eine Aufzeichnung abbricht und
// sich abmeldet, hinterlässt seinen vollständigen GPS-Verlauf für den
// nächsten Nutzer — der ihn beim Öffnen derselben Seite wiederaufnehmen und
// unter seinem eigenen Konto speichern könnte. localStorage überlebt das
// Abmelden (supabase.auth.signOut räumt nur die Session ab), deshalb muss
// die Trennung im Schlüssel stecken.
function key(userId: string, storageKey: string): string {
  return `cornice:tracking:${userId}:${storageKey}`;
}

// Ein Snapshot, der älter als das ist, wird nicht mehr wiederaufgenommen:
// eine vor Tagen abgebrochene Aufzeichnung soll nicht unvermittelt wieder
// auftauchen, wenn dieselbe Strecke erneut geöffnet wird. Grosszügig genug,
// dass eine offline beendete Fahrt am nächsten Tag noch gespeichert werden
// kann.
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Absichtlich fehlertolerant statt die Aufzeichnung daran scheitern zu
// lassen: localStorage kann in Private-Browsing-Kontexten oder bei vollem
// Speicher werfen — Tracking soll auch dann weiterlaufen, nur ohne
// Crash-Wiederherstellung.
export function saveTrackingSnapshot(
  userId: string,
  storageKey: string,
  snapshot: TrackingSnapshot,
): void {
  try {
    localStorage.setItem(key(userId, storageKey), JSON.stringify(snapshot));
  } catch {
    // Speichern übersprungen — Aufzeichnung läuft im Speicher trotzdem weiter.
  }
}

export function loadTrackingSnapshot(
  userId: string,
  storageKey: string,
): TrackingSnapshot | null {
  try {
    const raw = localStorage.getItem(key(userId, storageKey));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as TrackingSnapshot;
    if (Date.now() - snapshot.savedAt > SNAPSHOT_MAX_AGE_MS) {
      localStorage.removeItem(key(userId, storageKey));
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function clearTrackingSnapshot(userId: string, storageKey: string): void {
  try {
    localStorage.removeItem(key(userId, storageKey));
  } catch {
    // Nichts zu tun — beim nächsten Start wird ein veralteter Snapshot
    // ohnehin durch einen neuen überschrieben.
  }
}
