import { describe, expect, it } from "vitest";
import { detectLaps, type RouteCandidate } from "@/lib/lapDetection";
import { haversineKm, type TrailPoint } from "@/lib/geo";

// Quadratische Rundstrecke, ca. 500 m pro Seite (~2 km Umfang) bei 47.37° N —
// gross genug, um Korridor (80 m), Richtungs-Lock (200 m) und
// Umkehr-Abbruch (50 m) klar voneinander zu trennen, aber klein genug für
// schnelle Tests. Geschlossener Ring (letzter Punkt = erster).
function squareLoop(): { coordinates: [number, number][]; lengthKm: number } {
  const coordinates: [number, number][] = [
    [8.5, 47.37],
    [8.506635, 47.37],
    [8.506635, 47.374492],
    [8.5, 47.374492],
    [8.5, 47.37],
  ];
  let lengthKm = 0;
  for (let i = 1; i < coordinates.length; i++) {
    lengthKm += haversineKm(coordinates[i - 1], coordinates[i]);
  }
  return { coordinates, lengthKm };
}

// Punkt bei "km" Bogenlänge entlang des Loops (zyklisch, negative Werte
// laufen rückwärts vom Nullpunkt).
function pointAtKm(coords: [number, number][], lengthKm: number, km: number): [number, number] {
  let target = km % lengthKm;
  if (target < 0) target += lengthKm;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const segKm = haversineKm(coords[i - 1], coords[i]);
    if (acc + segKm >= target || i === coords.length - 1) {
      const t = segKm === 0 ? 0 : (target - acc) / segKm;
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
    }
    acc += segKm;
  }
  return coords[coords.length - 1];
}

// Simuliert eine Fahrt von "fromKm" nach "toKm" entlang des Loops (kann auch
// rückwärts sein) mit ~40 km/h und einem Punkt alle 5s — dicht genug, um
// innerhalb von Korridor und Kontinuitäts-Fenster zu bleiben.
function driveSegment(
  coords: [number, number][],
  lengthKm: number,
  fromKm: number,
  toKm: number,
  startSeconds: number,
  speedKmh = 40,
  stepSeconds = 5,
): { points: TrailPoint[]; endSeconds: number } {
  const distanceKm = toKm - fromKm;
  const totalSeconds = (Math.abs(distanceKm) / speedKmh) * 3600;
  const steps = Math.max(1, Math.round(totalSeconds / stepSeconds));
  const points: TrailPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const km = fromKm + distanceKm * frac;
    const [lng, lat] = pointAtKm(coords, lengthKm, km);
    points.push({ lng, lat, t: (startSeconds + frac * totalSeconds) * 1000 });
  }
  return { points, endSeconds: startSeconds + totalSeconds };
}

// Ein Punkt weit weg vom Loop, für "ausserhalb des Korridors"-Fälle.
function farAway(seconds: number): TrailPoint {
  return { lng: 9.2, lat: 47.9, t: seconds * 1000 };
}

describe("detectLaps", () => {
  it("erkennt eine volle Runde bei Einstieg mitten in der Strecke", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    // Einstieg bei km 1.0 (mitten in der Runde), eine volle Runde vorwärts.
    const { points } = driveSegment(coordinates, lengthKm, 1.0, 1.0 + lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].routeId).toBe("r1");
    expect(result.laps[0].entryT).toBe(points[0].t);
    expect(result.laps[0].exitT).toBeLessThanOrEqual(points[points.length - 1].t);
  });

  it("erkennt zwei Runden in Folge als zwei separate Completions", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    const { points } = driveSegment(coordinates, lengthKm, 0, 2 * lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(2);
    expect(result.laps[0].exitT).toBeLessThan(result.laps[1].exitT);
  });

  it("zählt eine abgebrochene Runde (Umkehr) nicht, meldet aber den erreichten Fortschritt", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    // 60% der Runde vorwärts, dann deutlich (>50m) zurück — ein echtes Wenden,
    // kein GPS-Jitter im Stand.
    const forward = driveSegment(coordinates, lengthKm, 0, 0.6 * lengthKm, 0);
    const back = driveSegment(
      coordinates,
      lengthKm,
      0.6 * lengthKm,
      0.6 * lengthKm - 0.3,
      forward.endSeconds,
    );

    const result = detectLaps([...forward.points, ...back.points], [candidate]);
    expect(result.laps).toHaveLength(0);
    expect(result.partialAttempts).toHaveLength(1);
    expect(result.partialAttempts[0].routeId).toBe("r1");
    expect(result.partialAttempts[0].maxProgressFraction).toBeGreaterThan(0.5);
    expect(result.partialAttempts[0].maxProgressFraction).toBeLessThan(0.65);
  });

  it("bricht nach einer zu langen Lücke ab, statt die Runde später fälschlich zu schliessen", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    // 40% der Runde vorwärts, dann > MAX_GAP_SECONDS weit weg vom Korridor
    // (z.B. abgestellt und zu Fuss weitergegangen), danach bei km 0 (nicht
    // an der erwarteten Fortsetzung) neu eingestiegen und den Rest gefahren
    // — das darf NICHT als eine durchgehende, geschlossene Runde zählen.
    const forward = driveSegment(coordinates, lengthKm, 0, 0.4 * lengthKm, 0);
    const gapStart = forward.endSeconds;
    const gapEnd = gapStart + 400; // > MAX_GAP_SECONDS (180s)
    const resume = driveSegment(coordinates, lengthKm, 0, lengthKm, gapEnd);

    const trail = [...forward.points, farAway(gapStart + 10), farAway(gapEnd), ...resume.points];
    const result = detectLaps(trail, [candidate]);

    // Der Neueinstieg bei km 0 fährt seinerseits eine volle Runde — das ist
    // ein separater, gültiger Versuch nach dem Abbruch, kein Fehlschlag des
    // Tests. Entscheidend ist: keine Runde überspannt die Lücke.
    for (const lap of result.laps) {
      expect(lap.entryT).toBeGreaterThanOrEqual(resume.points[0].t);
    }
  });

  it("bricht auch dann bei einer zu langen Lücke ab, wenn der Trail danach direkt wieder im Korridor liegt", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    // Regression: anders als im Test oben gibt es hier KEINEN Punkt
    // ausserhalb des Korridors während der Lücke (z.B. eine pausierte
    // Aufzeichnung, die exakt am selben Ort wieder aufnimmt) — die
    // Zeitlücken-Prüfung darf trotzdem greifen, nicht erst wenn ein Punkt
    // ausserhalb des Korridors liegt.
    const before = driveSegment(coordinates, lengthKm, 0, 0.4 * lengthKm, 0);
    const lastBefore = before.points[before.points.length - 1];
    const gapEndSeconds = lastBefore.t / 1000 + 200; // > MAX_GAP_SECONDS (180s)
    const after = driveSegment(coordinates, lengthKm, 0.4 * lengthKm, lengthKm, gapEndSeconds);

    const result = detectLaps([...before.points, ...after.points], [candidate]);

    // Die restlichen 60% der Strecke reichen für sich allein nicht für eine
    // volle Runde — keine Runde darf die Lücke überspannen.
    expect(result.laps).toHaveLength(0);
  });

  it("wertet ein kurzes Durchqueren des Korridors nicht als Runde", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates };

    // Nur wenige Punkte direkt am Streckenrand, weit unter dem
    // Richtungs-Lock-Schwellenwert — z.B. eine kreuzende Nebenstrasse.
    const { points } = driveSegment(coordinates, lengthKm, 0, 0.02, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(0);
  });

  it("liefert nichts für Kandidaten ausserhalb der Bounding Box des Trails", () => {
    const { coordinates, lengthKm } = squareLoop();
    const nearby: RouteCandidate = { routeId: "near", coordinates };
    const farCandidate: RouteCandidate = {
      routeId: "far",
      coordinates: [
        [20, -30],
        [20.01, -30],
        [20.01, -29.99],
      ],
    };

    const { points } = driveSegment(coordinates, lengthKm, 0, lengthKm, 0);
    const result = detectLaps(points, [nearby, farCandidate]);

    expect(result.laps.every((lap) => lap.routeId === "near")).toBe(true);
  });

  it("liefert ein leeres Ergebnis ohne Kandidaten oder mit zu kurzem Trail", () => {
    expect(detectLaps([], [])).toEqual({ laps: [], partialAttempts: [] });
    expect(detectLaps([{ lng: 8.5, lat: 47.37, t: 0 }], [])).toEqual({
      laps: [],
      partialAttempts: [],
    });
  });
});
