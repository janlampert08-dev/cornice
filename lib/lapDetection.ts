import { haversineKm, type TrailPoint } from "@/lib/geo";
import { CORRIDOR_KM } from "@/lib/routeCoverage";

// Erkennt innerhalb einer freien Fahrt, ob eine Rundstrecke vollständig
// abgefahren wurde — unabhängig davon, an welchem Punkt der Runde
// eingestiegen wurde. Läuft ausschliesslich auf dem bereits vereinfachten
// Trail (simplifyTrack, lib/track.ts): liefert nur Zeitfenster (entryT/
// exitT), aus denen der Aufrufer die eigentlichen Kennzahlen anschliessend
// aus dem ROHEN Trail-Ausschnitt neu berechnet — dieselbe Präzision wie bei
// einer regulär gestarteten Streckenfahrt, aber ohne für die Erkennung
// selbst tausende Rohpunkte durchlaufen zu müssen.
//
// Kernidee: die Streckengeometrie wird als Umlaufweg mit Bogenlänge
// s ∈ [0, L] parametrisiert. Jeder Trail-Punkt wird darauf projiziert; eine
// volle, in eine Richtung durchgehende Runde (progress ≥ 95% von L) zählt
// als Completion — unabhängig vom Startpunkt der Projektion.

// Feste Abtastung der Streckengeometrie für die Projektion (wie sampleRoute
// in routeCoverage.ts, hier aber feiner, weil die Bogenlängen-Position
// selbst das Ergebnis ist, nicht nur ein Coverage-Prozentsatz).
const SAMPLE_INTERVAL_KM = 0.025;

// Bevor genug netto Fortschritt in eine Richtung vorliegt, gilt die
// Fahrtrichtung als nicht festgelegt — die Projektion sucht dann global
// statt in einem erwarteten Fenster (siehe findBestProjection). Das ist das
// einzige Zeitfenster, in dem eine Mehrdeutigkeit an einer sich selbst
// kreuzenden Strecke theoretisch zu einer falschen Zuordnung führen könnte;
// abgefedert durch den finalen Coverage-Gegencheck beim Aufrufer.
const DIRECTION_LOCK_KM = 0.2;

// Sustained Gegenrichtung (nicht nur GPS-Jitter im Stand) bricht den
// aktuellen Rundenversuch ab — der Fall "60% gefahren, dann umgedreht".
const REVERSAL_ABORT_KM = 0.05;

// Verlässt der Trail den Korridor bzw. das erwartete Fenster länger als
// diese Zeitspanne, gilt der Versuch als abgebrochen (echtes Verlassen der
// Strecke), nicht mehr als Tunnel/kurze Umfahrung.
const MAX_GAP_SECONDS = 180;

// Ab diesem Anteil der Streckenlänge gilt eine Runde als geschlossen — nicht
// buchstäblich 100%, um Schnapp-Ungenauigkeit am Rundenschluss zu erlauben.
// Der Aufrufer prüft zusätzlich, unabhängig davon, computeRouteCoverage()
// auf dem Zeitfenster-Ausschnitt (siehe lib/routeCoverage.ts) — zwei
// unabhängige Signale müssen beide zustimmen.
const LAP_CLOSE_FRACTION = 0.95;

// Obergrenze für die beim Projizieren angenommene Geschwindigkeit — bestimmt
// nur die Breite des Kontinuitäts-Suchfensters, keine Plausibilitätsprüfung
// (die läuft unverändert über implausibilityReason auf dem Rohtrail).
const MAX_SEARCH_SPEED_KMH = 160;

export interface RouteCandidate {
  routeId: string;
  coordinates: [number, number][];
}

export interface DetectedLap {
  routeId: string;
  entryT: number;
  exitT: number;
}

export interface PartialAttempt {
  routeId: string;
  maxProgressFraction: number;
}

export interface LapDetectionResult {
  laps: DetectedLap[];
  // Höchster je erreichter Fortschritt eines nie geschlossenen Versuchs —
  // rein informativ für den Fazit-Screen ("Strecke X zu 60% gefahren"),
  // keine Fahrt, keine Aktion nötig.
  partialAttempts: PartialAttempt[];
}

interface ArcSample {
  s: number;
  point: [number, number];
}

function buildArcTable(coords: [number, number][]): { samples: ArcSample[]; lengthKm: number } {
  if (coords.length < 2) return { samples: [], lengthKm: 0 };

  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineKm(coords[i - 1], coords[i]));
  }
  const lengthKm = cumulative[cumulative.length - 1];

  const samples: ArcSample[] = [];
  let nextTarget = 0;
  for (let i = 0; i < coords.length; i++) {
    if (cumulative[i] >= nextTarget || i === coords.length - 1) {
      samples.push({ s: cumulative[i], point: coords[i] });
      nextTarget = cumulative[i] + SAMPLE_INTERVAL_KM;
    }
  }
  return { samples, lengthKm };
}

const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LON = 111_320;

function projectToSegment(
  point: [number, number],
  a: ArcSample,
  b: ArcSample,
  cosRefLat: number,
): { distanceKm: number; s: number } {
  const toXY = ([lng, lat]: [number, number]) => ({
    x: lng * METERS_PER_DEG_LON * cosRefLat,
    y: lat * METERS_PER_DEG_LAT,
  });
  const p = toXY(point);
  const pa = toXY(a.point);
  const pb = toXY(b.point);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSquared));
  const footX = pa.x + t * dx;
  const footY = pa.y + t * dy;
  const distanceKm = Math.hypot(p.x - footX, p.y - footY) / 1000;
  return { distanceKm, s: a.s + t * (b.s - a.s) };
}

function circularDistance(a: number, b: number, lengthKm: number): number {
  const diff = Math.abs(a - b) % lengthKm;
  return Math.min(diff, lengthKm - diff);
}

// Ohne "window": globale Suche nach dem geometrisch nächsten Punkt (Einstieg,
// oder solange die Richtung noch nicht feststeht). Mit "window": nur
// Segmente in der Nähe der erwarteten Bogenlänge — genau der
// Kontinuitäts-Mechanismus, der Mehrdeutigkeiten an Kreuzungen/sich selbst
// überschneidenden Streckenabschnitten auflöst (siehe Moduskommentar oben).
function findBestProjection(
  point: [number, number],
  samples: ArcSample[],
  lengthKm: number,
  window: { centerS: number; radiusKm: number } | null,
): { distanceKm: number; s: number } | null {
  const cosRefLat = Math.cos((point[1] * Math.PI) / 180);
  let best: { distanceKm: number; s: number } | null = null;
  for (let i = 0; i < samples.length - 1; i++) {
    if (window) {
      const mid = (samples[i].s + samples[i + 1].s) / 2;
      if (circularDistance(mid, window.centerS, lengthKm) > window.radiusKm + SAMPLE_INTERVAL_KM) {
        continue;
      }
    }
    const projected = projectToSegment(point, samples[i], samples[i + 1], cosRefLat);
    if (!best || projected.distanceKm < best.distanceKm) best = projected;
  }
  return best;
}

function wrappedDelta(from: number, to: number, lengthKm: number): number {
  let delta = to - from;
  if (delta > lengthKm / 2) delta -= lengthKm;
  if (delta < -lengthKm / 2) delta += lengthKm;
  return delta;
}

interface LapAttemptState {
  active: boolean;
  lapEntryT: number;
  lastS: number;
  lastT: number;
  direction: 1 | -1 | 0;
  rawLockProgress: number;
  progressKm: number;
  reversalKm: number;
  maxProgressFraction: number;
  // true, wenn seit dem letzten Treffer mindestens ein Punkt den Korridor
  // verlassen hat. Verhindert das Verschmelzen eines Lücken-Sprungs mit
  // echtem Fortschritt, siehe Kommentar bei der Verwendung unten.
  missedSinceHit: boolean;
}

function freshState(): LapAttemptState {
  return {
    active: false,
    lapEntryT: 0,
    lastS: 0,
    lastT: 0,
    direction: 0,
    rawLockProgress: 0,
    progressKm: 0,
    reversalKm: 0,
    maxProgressFraction: 0,
    missedSinceHit: false,
  };
}

function detectLapsForRoute(
  trail: TrailPoint[],
  candidate: RouteCandidate,
): { laps: DetectedLap[]; maxProgressFraction: number } {
  const { samples, lengthKm } = buildArcTable(candidate.coordinates);
  if (lengthKm <= 0 || samples.length < 2) return { laps: [], maxProgressFraction: 0 };

  const laps: DetectedLap[] = [];
  let state = freshState();
  let overallMaxFraction = 0;

  const abort = () => {
    overallMaxFraction = Math.max(overallMaxFraction, state.maxProgressFraction);
    state = freshState();
  };

  for (const point of trail) {
    const p: [number, number] = [point.lng, point.lat];

    // Muss VOR der Fenstersuche laufen und unabhängig davon, ob dieser
    // Punkt selbst im Korridor landet: sonst bleibt eine echte Lücke
    // unentdeckt, wenn der Trail (z.B. wegen einer pausierten Aufzeichnung)
    // nach der Lücke zufällig direkt wieder im Korridor aufsetzt — ein
    // Punkt, der stets "trifft", hätte den alten Check (nur im
    // Nicht-Treffer-Zweig) nie erreicht.
    if (state.active) {
      const gapSeconds = (point.t - state.lastT) / 1000;
      if (gapSeconds > MAX_GAP_SECONDS) abort();
    }

    if (!state.active) {
      const hit = findBestProjection(p, samples, lengthKm, null);
      if (hit && hit.distanceKm <= CORRIDOR_KM) {
        state.active = true;
        state.lapEntryT = point.t;
        state.lastS = hit.s;
        state.lastT = point.t;
      }
      continue;
    }

    const expectedDeltaKm = Math.min(
      1.5,
      ((point.t - state.lastT) / 3_600_000) * MAX_SEARCH_SPEED_KMH,
    );
    const window =
      state.direction !== 0
        ? {
            centerS: state.lastS + state.direction * expectedDeltaKm,
            radiusKm: Math.max(0.3, expectedDeltaKm * 2),
          }
        : null;

    const hit = findBestProjection(p, samples, lengthKm, window);
    if (!hit || hit.distanceKm > CORRIDOR_KM) {
      state.missedSinceHit = true;
      continue;
    }

    if (state.missedSinceHit) {
      // Der Trail hat den Korridor seit dem letzten Treffer verlassen.
      // wrappedDelta() liefert für einen solchen Sprung immer den kürzesten
      // Weg auf dem Ringmodell der Strecke — das ist nur eine Vermutung,
      // keine Beobachtung: ob der Nutzer diesen Bogen wirklich durchgehend
      // gefahren ist oder zufällig an einer ganz anderen Stelle wieder in
      // den Korridor eingetreten ist, lässt sich aus einem einzelnen Sprung
      // nicht unterscheiden. Realer Fall, der genau das offengelegt hat: ein
      // Trail verliess den Korridor für mehrere Punkte und traf beim
      // Wiedereintritt zufällig nur wenige Meter neben dem Streckenanfang
      // auf — der Sprung "über den Rundenschluss" wurde dadurch als 1.8 km
      // Fortschritt in Fahrtrichtung fehlinterpretiert, obwohl der
      // dazwischenliegende Bogen nie befahren wurde. Statt zu raten: der
      // Wiedereintritt zählt als neuer Rundenversuch, kein Fortschritt wird
      // verschenkt — sichere Richtung, siehe Moduskommentar oben.
      //
      // Gilt ausdrücklich in BEIDEN Phasen, vor wie nach dem Richtungs-Lock.
      // Die frühere Fassung markierte den Austritt nur solange die Richtung
      // noch offen war, in der Annahme, das Kontinuitäts-Fenster oben fange
      // den Fall danach ab. Das trägt nicht: dessen Radius wächst mit der
      // verstrichenen Zeit (bis 1.5 km, Radius 2x) und ist an keine
      // Streckenlänge gekoppelt — auf einer kurzen Rundstrecke umspannt es
      // nach wenigen Sekunden ausserhalb des Korridors den gesamten Ring und
      // akzeptiert damit jeden beliebigen Wiedereintritt als Fortschritt.
      // Real aufgefallen an einer 5.7-km-Runde: die Anfahrt zum offiziellen
      // Startpunkt lief ein Stück im Korridor (Richtung dadurch bereits
      // gesperrt), verliess ihn, und der Wiedereintritt am Startpunkt wurde
      // als +1.85 km gutgeschrieben. Zusammen mit der danach real gefahrenen
      // Runde galt sie ~36% zu früh als geschlossen; das Zeitfenster endete
      // mitten in der Runde und der Deckungsgrad des Ausschnitts fiel auf
      // 71% (siehe lib/actions/completions.ts, buildDetectedSegments).
      abort();
      state.active = true;
      state.lapEntryT = point.t;
      state.lastS = hit.s;
      state.lastT = point.t;
      continue;
    }

    const delta = wrappedDelta(state.lastS, hit.s, lengthKm);

    if (state.direction === 0) {
      state.rawLockProgress += delta;
      state.lastS = hit.s;
      state.lastT = point.t;
      if (Math.abs(state.rawLockProgress) >= DIRECTION_LOCK_KM) {
        state.direction = state.rawLockProgress > 0 ? 1 : -1;
        state.progressKm = Math.abs(state.rawLockProgress);
        state.maxProgressFraction = state.progressKm / lengthKm;
      }
      continue;
    }

    const forwardDelta = delta * state.direction;
    state.lastS = hit.s;
    state.lastT = point.t;

    if (forwardDelta < 0) {
      state.reversalKm += -forwardDelta;
      if (state.reversalKm >= REVERSAL_ABORT_KM) abort();
      continue;
    }

    state.reversalKm = 0;
    state.progressKm += forwardDelta;
    state.maxProgressFraction = Math.max(state.maxProgressFraction, state.progressKm / lengthKm);

    if (state.progressKm >= lengthKm * LAP_CLOSE_FRACTION) {
      laps.push({ routeId: candidate.routeId, entryT: state.lapEntryT, exitT: point.t });
      state.progressKm -= lengthKm;
      state.lapEntryT = point.t;
      state.maxProgressFraction = 0;
    }
  }

  overallMaxFraction = Math.max(overallMaxFraction, state.maxProgressFraction);
  return { laps, maxProgressFraction: overallMaxFraction };
}

function bboxOf(points: [number, number][]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

type Bbox = ReturnType<typeof bboxOf>;

// Grober, aber billiger Vorfilter, um teure Projektion für Kandidaten zu
// überspringen, die offensichtlich nirgends in der Nähe des Trails liegen.
// 1° ≈ 100 km ist an keinem Punkt der Schweiz stark genug verzerrt, um für
// einen reinen Vorfilter (kein Ausschlusskriterium mit Sicherheitsanspruch,
// nur eine Performance-Abkürzung) problematisch zu sein.
function bboxesOverlap(a: Bbox, b: Bbox, marginKm: number): boolean {
  const marginDeg = marginKm / 100;
  return (
    a.minLng - marginDeg <= b.maxLng &&
    a.maxLng + marginDeg >= b.minLng &&
    a.minLat - marginDeg <= b.maxLat &&
    a.maxLat + marginDeg >= b.minLat
  );
}

export function detectLaps(trail: TrailPoint[], candidates: RouteCandidate[]): LapDetectionResult {
  const laps: DetectedLap[] = [];
  const partialAttempts: PartialAttempt[] = [];
  if (trail.length < 2 || candidates.length === 0) return { laps, partialAttempts };

  const trailBbox = bboxOf(trail.map((p): [number, number] => [p.lng, p.lat]));

  for (const candidate of candidates) {
    if (candidate.coordinates.length < 2) continue;
    const routeBbox = bboxOf(candidate.coordinates);
    if (!bboxesOverlap(trailBbox, routeBbox, CORRIDOR_KM + 0.5)) continue;

    const result = detectLapsForRoute(trail, candidate);
    laps.push(...result.laps);
    if (result.laps.length === 0 && result.maxProgressFraction > 0) {
      partialAttempts.push({
        routeId: candidate.routeId,
        maxProgressFraction: result.maxProgressFraction,
      });
    }
  }

  return { laps, partialAttempts };
}
