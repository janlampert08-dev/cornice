import { haversineKm, type TrailPoint } from "@/lib/geo";

// Toleranz der Track-Vereinfachung vor dem Speichern. 5 m liegt deutlich
// unter der GPS-Genauigkeit, die wir überhaupt akzeptieren (MIN_ACCURACY_M
// = 50 m im Recorder) — die gespeicherte Linie ist damit optisch nicht von
// den Rohpunkten zu unterscheiden, braucht aber nur einen Bruchteil der
// Punkte (eine zweistündige Fahrt schrumpft typischerweise von mehreren
// tausend auf wenige hundert Punkte).
export const TRACK_SIMPLIFY_TOLERANCE_M = 5;

// Obergrenze für die Rohpunkte, die eine einzelne Fahrt mitbringen darf.
// Bei einem GPS-Fix pro Sekunde entspricht das gut fünf Stunden Fahrt —
// alles darüber ist entweder ein Fehler oder ein Versuch, den Server über
// die Trail-Berechnung zu beschäftigen.
export const MAX_TRAIL_POINTS = 20_000;

// Grösster erlaubter Sprung zwischen zwei aufeinanderfolgenden Punkten.
// Echte Lücken entstehen durch Tunnel oder verlorenen Empfang und bleiben
// darunter; alles darüber deutet auf einen zusammengesetzten oder
// gefälschten Trail hin.
export const MAX_JUMP_KM = 2;

// Obergrenze für die Gesamtdauer einer Aufzeichnung — fängt den Fall
// "Aufzeichnung nach der Fahrt vergessen zu stoppen" ab, statt eine
// 30-Stunden-Fahrt mit absurdem Durchschnittstempo zu speichern.
export const MAX_RIDE_SECONDS = 12 * 3600;

// Ab dieser Geschwindigkeit zählt ein Segment als Fahrt statt als Pause.
// Bewusst niedrig: Schrittgeschwindigkeit im Stau ist Fahrzeit, GPS-Zittern
// im Stand (Ampel, Kaffeepause) ist es nicht.
export const MOVING_MIN_KMH = 2;

// Meter pro Grad, für die lokale Projektion in der Vereinfachung. Nur für
// Abstände von wenigen Metern innerhalb einer Fahrt benutzt — in diesem
// Massstab ist die Näherung (Breitengrad konstant) unerheblich genau.
const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LON = 111_320;

interface ProjectedPoint {
  x: number;
  y: number;
}

function project(point: TrailPoint, cosRefLat: number): ProjectedPoint {
  return { x: point.lng * METERS_PER_DEG_LON * cosRefLat, y: point.lat * METERS_PER_DEG_LAT };
}

// Abstand von "point" zur Geraden durch "start" und "end" (beide bereits in
// Metern projiziert). Fallen Start und Ende zusammen, wird auf den reinen
// Punktabstand zurückgefallen.
function perpendicularDistanceM(
  point: ProjectedPoint,
  start: ProjectedPoint,
  end: ProjectedPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const cross = Math.abs(dy * (point.x - start.x) - dx * (point.y - start.y));
  return cross / Math.sqrt(lengthSquared);
}

// Douglas-Peucker, iterativ statt rekursiv: bei bis zu MAX_TRAIL_POINTS
// Punkten kann die Rekursionstiefe im ungünstigsten Fall (nahezu gerade
// Strecke) linear wachsen und den Stack sprengen.
//
// Vereinfacht wird ausschliesslich die gespeicherte Geometrie — Distanz,
// Dauer und Deckungsgrad werden immer aus den Rohpunkten berechnet (siehe
// lib/actions/completions.ts), damit die Vereinfachung keine Kennzahl
// verändern kann.
export function simplifyTrack(
  points: TrailPoint[],
  toleranceM: number = TRACK_SIMPLIFY_TOLERANCE_M,
): TrailPoint[] {
  if (points.length <= 2) return [...points];

  const cosRefLat = Math.cos((points[0].lat * Math.PI) / 180);
  const projected = points.map((p) => project(p, cosRefLat));
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last - first < 2) continue;

    let maxDistance = 0;
    let index = first;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistanceM(projected[i], projected[first], projected[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    if (maxDistance > toleranceM) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// Reine Bewegtzeit: Summe der Segmentdauern, deren Durchschnittstempo über
// MOVING_MIN_KMH liegt. Pausen (Kaffee, Fotostopp, Ampel) fallen damit
// heraus, ohne dass der Nutzer einen Pause-Knopf bedienen müsste — und ohne
// dass dem Client eine Zahl geglaubt werden müsste, denn gerechnet wird
// serverseitig aus demselben Trail wie alle anderen Kennzahlen.
export function movingSeconds(points: TrailPoint[], minKmh: number = MOVING_MIN_KMH): number {
  let seconds = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const deltaSeconds = (current.t - previous.t) / 1000;
    if (deltaSeconds <= 0) continue;
    const km = haversineKm([previous.lng, previous.lat], [current.lng, current.lat]);
    if (km / (deltaSeconds / 3600) >= minKmh) seconds += deltaSeconds;
  }
  return Math.round(seconds);
}

// Grösster Abstand zwischen zwei aufeinanderfolgenden Punkten — Indikator
// für einen zusammengesetzten oder gefälschten Trail (siehe MAX_JUMP_KM).
export function maxJumpKm(points: TrailPoint[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const km = haversineKm([points[i - 1].lng, points[i - 1].lat], [points[i].lng, points[i].lat]);
    if (km > max) max = km;
  }
  return max;
}

// Sechs Nachkommastellen entsprechen gut 0.1 m — jenseits jeder GPS-
// Genauigkeit, spart aber gegenüber der vollen Float-Darstellung deutlich
// Platz in der Geometrie.
const COORD_PRECISION = 6;

// EWKT für den direkten Insert in die geography-Spalte (PostgREST reicht den
// String durch, Postgres wendet die Eingabefunktion des Typs an). Liefert
// null, wenn nach dem Entfernen aufeinanderfolgender Duplikate weniger als
// zwei Punkte übrig bleiben — ein LineString braucht mindestens zwei.
export function toEwktLineString(points: TrailPoint[]): string | null {
  const parts: string[] = [];
  let previous: string | null = null;
  for (const point of points) {
    const coordinate = `${point.lng.toFixed(COORD_PRECISION)} ${point.lat.toFixed(COORD_PRECISION)}`;
    if (coordinate === previous) continue;
    parts.push(coordinate);
    previous = coordinate;
  }
  if (parts.length < 2) return null;
  return `SRID=4326;LINESTRING(${parts.join(",")})`;
}
