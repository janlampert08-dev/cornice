import type { TempolimitSegment } from "@/types/database";

export function haversineKm(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number],
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Grobe Schätzung — Luftlinie mit Umwegfaktor für reale Strassenführung,
// keine echte Routenberechnung. Immer als Näherung kennzeichnen.
const STRASSEN_UMWEGFAKTOR = 1.3;

export function estimateApproachMinutes(distanceKm: number, avgKmh = 50): number {
  return Math.round(((distanceKm * STRASSEN_UMWEGFAKTOR) / avgKmh) * 60);
}

// Längengewichtetes mittleres Tempolimit entlang der Strecke.
export function averageTempolimit(segments: TempolimitSegment[] | null | undefined): number | null {
  if (!segments || segments.length === 0) return null;
  const totalKm = segments.reduce((sum, s) => sum + (s.km_bis - s.km_von), 0);
  if (totalKm <= 0) return null;
  const weighted = segments.reduce((sum, s) => sum + s.kmh * (s.km_bis - s.km_von), 0);
  return Math.round(weighted / totalKm);
}

// Reale Reisegeschwindigkeit liegt unter dem Limit (Kurven, Ortsdurchfahrten,
// Gegenverkehr) — Erfahrungswert statt Bestzeit-Anspruch.
const REALISTISCHER_ANTEIL_AM_LIMIT = 0.8;

// Nutzt echte Tempolimit-Daten, falls vorhanden (siehe TempolimitSegment),
// sonst eine grobe Kategorie-Faustregel als Fallback.
export function estimateRouteDurationMinutes(
  laengeKm: number,
  kategorien: string[],
  tempolimits?: TempolimitSegment[] | null,
): number {
  const avgLimit = averageTempolimit(tempolimits);
  if (avgLimit) {
    return Math.round((laengeKm / (avgLimit * REALISTISCHER_ANTEIL_AM_LIMIT)) * 60);
  }
  const kurvig = kategorien.includes("kurvig") || kategorien.includes("passstrasse");
  const avgKmh = kurvig ? 35 : 55;
  return Math.round((laengeKm / avgKmh) * 60);
}

export interface TrailPoint {
  lng: number;
  lat: number;
  // Client-Zeitstempel (Date.now(), ms) im Moment der GPS-Messung.
  t: number;
}

// Gleiche Segment-Mindestlänge wie die Live-Distanzberechnung in
// LiveTrackingForm — verhindert, dass GPS-Jitter im Stillstand als
// zurückgelegte Distanz gezählt wird.
const MIN_SEGMENT_KM = 0.005;

// Berechnet Distanz und Dauer serverseitig ausschliesslich aus dem
// aufgezeichneten GPS-Trail — bewusst unabhängig von den vom Client separat
// mitgeschickten distanz_km/dauer_sekunden-Feldern, die sich sonst beliebig
// fälschen liessen (siehe lib/actions/completions.ts).
export function computeTrailStats(trail: TrailPoint[]): {
  distanceKm: number;
  durationSeconds: number;
} {
  if (trail.length < 2) return { distanceKm: 0, durationSeconds: 0 };

  let distanceKm = 0;
  let last = trail[0];
  for (let i = 1; i < trail.length; i++) {
    const point = trail[i];
    const segment = haversineKm([last.lng, last.lat], [point.lng, point.lat]);
    if (segment > MIN_SEGMENT_KM) {
      distanceKm += segment;
      last = point;
    }
  }

  const durationSeconds = Math.round((trail[trail.length - 1].t - trail[0].t) / 1000);
  return { distanceKm, durationSeconds };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
