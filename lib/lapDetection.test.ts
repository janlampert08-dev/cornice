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

// Eckpunkte der offenen Punkt-zu-Punkt-Strecke A → B, L-förmig, ca. 1.5 km:
// erst ~500 m nach Osten, dann ~1000 m nach Norden. Kein geschlossener Ring
// — Anfang und Ende liegen weit auseinander.
function openRouteCorners(): [number, number][] {
  return [
    [8.5, 47.37],
    [8.506635, 47.37],
    [8.506635, 47.378984],
  ];
}

// Dieselbe Strecke, aber nur mit ihren Eckpunkten — ein einzelnes Segment
// läuft hier über 1000 m am Stück, wie bei einer von Hand gezeichneten
// langen Geraden.
function coarseOpenRoute(): { coordinates: [number, number][]; lengthKm: number } {
  const coordinates = openRouteCorners();
  let lengthKm = 0;
  for (let i = 1; i < coordinates.length; i++) {
    lengthKm += haversineKm(coordinates[i - 1], coordinates[i]);
  }
  return { coordinates, lengthKm };
}

//
// Dicht gestützt (~20 m zwischen zwei Punkten), wie eine echte Mapbox-/
// GPX-Geometrie. Für den grob gestützten Fall siehe coarseOpenRoute() unten.
function openRoute(): { coordinates: [number, number][]; lengthKm: number } {
  const corners = openRouteCorners();
  const coordinates: [number, number][] = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const steps = Math.max(1, Math.round((haversineKm(corners[i - 1], corners[i]) * 1000) / 20));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      coordinates.push([
        corners[i - 1][0] + (corners[i][0] - corners[i - 1][0]) * t,
        corners[i - 1][1] + (corners[i][1] - corners[i - 1][1]) * t,
      ]);
    }
  }

  let lengthKm = 0;
  for (let i = 1; i < coordinates.length; i++) {
    lengthKm += haversineKm(coordinates[i - 1], coordinates[i]);
  }
  return { coordinates, lengthKm };
}

// Wie pointAtKm, aber ohne Umlauf: auf einer offenen Strecke ist km =
// lengthKm das Ziel B und nicht wieder der Start A.
function pointAtKmOpen(
  coords: [number, number][],
  lengthKm: number,
  km: number,
): [number, number] {
  const target = Math.min(Math.max(km, 0), lengthKm);
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

// driveSegment für offene Strecken (ohne Umlauf).
function driveOpen(
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
    const [lng, lat] = pointAtKmOpen(coords, lengthKm, fromKm + distanceKm * frac);
    points.push({ lng, lat, t: (startSeconds + frac * totalSeconds) * 1000 });
  }
  return { points, endSeconds: startSeconds + totalSeconds };
}

describe("detectLaps", () => {
  it("erkennt eine volle Runde bei Einstieg mitten in der Strecke", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

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
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

    const { points } = driveSegment(coordinates, lengthKm, 0, 2 * lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(2);
    expect(result.laps[0].exitT).toBeLessThan(result.laps[1].exitT);
  });

  it("zählt eine abgebrochene Runde (Umkehr) nicht, meldet aber den erreichten Fortschritt", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

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
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

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
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

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

  it("verschenkt keinen Fortschritt, wenn ein Wiedereintritt nach einer Lücke zufällig nah am Rundenschluss liegt", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

    // Regression: Einstieg bei km 1.0, wenige Meter Fortschritt (Richtung
    // noch nicht gesperrt) — dann eine kurze Lücke (unter MAX_GAP_SECONDS,
    // löst also NICHT den Zeitlücken-Abbruch aus), danach Wiedereintritt bei
    // km 0. wrappedDelta() interpretiert den Sprung von km 1.05 zu km 0
    // als kürzesten Weg auf dem Ring — vorwärts über den Rundenschluss
    // (lengthKm - 1.05) ist kürzer als rückwärts (1.05) und hätte vor dem
    // Fix sofort > DIRECTION_LOCK_KM (0.2 km) Fortschritt gutgeschrieben,
    // obwohl dieser Bogen nie befahren wurde — exakt das Muster, das eine
    // real aufgezeichnete Fahrt live als vorzeitig geschlossene Runde
    // (ca. 30 Prozentpunkte zu früh) auffliegen liess.
    const forward1 = driveSegment(coordinates, lengthKm, 1.0, 1.05, 0);
    const gapStart = forward1.endSeconds;
    const gapEnd = gapStart + 60; // deutlich unter MAX_GAP_SECONDS (180s)
    const forward2 = driveSegment(coordinates, lengthKm, 0, lengthKm, gapEnd);

    const trail = [...forward1.points, farAway(gapStart + 10), farAway(gapEnd - 5), ...forward2.points];
    const result = detectLaps(trail, [candidate]);

    expect(result.laps).toHaveLength(1);
    // Der Wiedereintritt bei km 0 zählt als neuer Rundenversuch — die
    // erkannte Runde beginnt dort, nicht beim ursprünglichen Einstieg vor
    // der Lücke.
    expect(result.laps[0].entryT).toBe(forward2.points[0].t);
  });

  it("schliesst die Runde nicht zu früh, wenn der Wiedereintritt nach bereits gesperrter Richtung am Rundenschluss liegt", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

    // Regression zum Test darüber, aber mit bereits GESPERRTER Fahrtrichtung:
    // die Anfahrt läuft 300 m im Korridor (> DIRECTION_LOCK_KM), verlässt ihn
    // dann und tritt am Streckenanfang wieder ein. Der Sprung von km 1.3 auf
    // km 0 ist auf dem Ring vorwärts kürzer als rückwärts und wurde vor dem
    // Fix als echter Fortschritt gutgeschrieben — die anschliessend real
    // gefahrene volle Runde galt dadurch schon nach ~60% als geschlossen, und
    // das an exitT abgeschnittene Zeitfenster deckte nur einen Teil der
    // Strecke ab. Genau dieses Muster hat eine real aufgezeichnete Fahrt auf
    // einer 5.7-km-Runde mit 71% statt 100% Deckungsgrad ausgelöst.
    const approach = driveSegment(coordinates, lengthKm, 1.0, 1.3, 0);
    const gapStart = approach.endSeconds;
    const gapEnd = gapStart + 60; // deutlich unter MAX_GAP_SECONDS (180s)
    const lap = driveSegment(coordinates, lengthKm, 0, lengthKm, gapEnd);

    const trail = [...approach.points, farAway(gapStart + 10), farAway(gapEnd - 5), ...lap.points];
    const result = detectLaps(trail, [candidate]);

    expect(result.laps).toHaveLength(1);
    // Der Wiedereintritt eröffnet einen neuen Rundenversuch: die Runde beginnt
    // am Streckenanfang, nicht bereits bei der Anfahrt.
    expect(result.laps[0].entryT).toBe(lap.points[0].t);
    // Und sie schliesst erst am Ende der tatsächlich gefahrenen Runde — das
    // Zeitfenster deckt damit die ganze Strecke ab, nicht nur ein Teilstück.
    const lapDurationMs = lap.points[lap.points.length - 1].t - lap.points[0].t;
    expect(result.laps[0].exitT - result.laps[0].entryT).toBeGreaterThanOrEqual(
      lapDurationMs * 0.9,
    );
  });

  it("wertet ein kurzes Durchqueren des Korridors nicht als Runde", () => {
    const { coordinates, lengthKm } = squareLoop();
    const candidate: RouteCandidate = { routeId: "r1", coordinates, isLoop: true };

    // Nur wenige Punkte direkt am Streckenrand, weit unter dem
    // Richtungs-Lock-Schwellenwert — z.B. eine kreuzende Nebenstrasse.
    const { points } = driveSegment(coordinates, lengthKm, 0, 0.02, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(0);
  });

  it("liefert nichts für Kandidaten ausserhalb der Bounding Box des Trails", () => {
    const { coordinates, lengthKm } = squareLoop();
    const nearby: RouteCandidate = { routeId: "near", coordinates, isLoop: true };
    const farCandidate: RouteCandidate = {
      routeId: "far",
      coordinates: [
        [20, -30],
        [20.01, -30],
        [20.01, -29.99],
      ],
      isLoop: true,
    };

    const { points } = driveSegment(coordinates, lengthKm, 0, lengthKm, 0);
    const result = detectLaps(points, [nearby, farCandidate]);

    expect(result.laps.every((lap) => lap.routeId === "near")).toBe(true);
  });

  it("erkennt eine Punkt-zu-Punkt-Strecke von A nach B", () => {
    const { coordinates, lengthKm } = openRoute();
    const candidate: RouteCandidate = { routeId: "a2b", coordinates, isLoop: false };

    const { points } = driveOpen(coordinates, lengthKm, 0, lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].routeId).toBe("a2b");
    expect(result.laps[0].entryT).toBe(points[0].t);
  });

  it("erkennt dieselbe Punkt-zu-Punkt-Strecke auch rückwärts von B nach A", () => {
    const { coordinates, lengthKm } = openRoute();
    const candidate: RouteCandidate = { routeId: "a2b", coordinates, isLoop: false };

    const { points } = driveOpen(coordinates, lengthKm, lengthKm, 0, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].entryT).toBe(points[0].t);
  });

  it("erkennt eine Punkt-zu-Punkt-Strecke nicht, wenn erst mitten drin eingestiegen wird", () => {
    const { coordinates, lengthKm } = openRoute();
    const candidate: RouteCandidate = { routeId: "a2b", coordinates, isLoop: false };

    // Einstieg bei 30% und bis zum Ziel gefahren: 70% Fortschritt, unter der
    // 95%-Schwelle. Anders als bei einer Rundfahrt gibt es hier keinen
    // beliebigen Einstiegspunkt — wer nicht an A oder B beginnt, hat die
    // Strecke schlicht nicht ganz gefahren. Genau das erzwingt die Schwelle
    // von selbst, ohne separate Endpunkt-Prüfung.
    const { points } = driveOpen(coordinates, lengthKm, 0.3 * lengthKm, lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(0);
    expect(result.partialAttempts).toHaveLength(1);
    expect(result.partialAttempts[0].maxProgressFraction).toBeGreaterThan(0.6);
    expect(result.partialAttempts[0].maxProgressFraction).toBeLessThan(0.75);
  });

  it("zählt eine Hin- und Rückfahrt auf einer Punkt-zu-Punkt-Strecke als zwei Completions", () => {
    const { coordinates, lengthKm } = openRoute();
    const candidate: RouteCandidate = { routeId: "a2b", coordinates, isLoop: false };

    const hin = driveOpen(coordinates, lengthKm, 0, lengthKm, 0);
    const rueck = driveOpen(coordinates, lengthKm, lengthKm, 0, hin.endSeconds);

    const result = detectLaps([...hin.points, ...rueck.points], [candidate]);
    expect(result.laps).toHaveLength(2);
    expect(result.laps[0].exitT).toBeLessThan(result.laps[1].exitT);
  });

  it("erkennt auch eine grob gestützte Strecke mit sehr langen Einzelsegmenten", () => {
    const { coordinates, lengthKm } = coarseOpenRoute();
    const candidate: RouteCandidate = { routeId: "grob", coordinates, isLoop: false };

    // Regression: buildArcTable() dünnt dichte Geometrien auf
    // SAMPLE_INTERVAL_KM aus, kann eine grobe aber nicht verfeinern — hier
    // bleibt ein Segment über 1000 m am Stück. Solange das Suchfenster in
    // findBestProjection() den Abstand ab dem Segment-MITTELPUNKT mass, fiel
    // ein Fahrzeug mitten auf diesem Segment aus dem Fenster: das Segment
    // wurde übersprungen, der Punkt galt als ausserhalb des Korridors, und
    // die Erkennung brach mitten in der Strecke ab.
    const { points } = driveOpen(coordinates, lengthKm, 0, lengthKm, 0);

    const result = detectLaps(points, [candidate]);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].entryT).toBe(points[0].t);
  });

  it("liefert ein leeres Ergebnis ohne Kandidaten oder mit zu kurzem Trail", () => {
    expect(detectLaps([], [])).toEqual({ laps: [], partialAttempts: [] });
    expect(detectLaps([{ lng: 8.5, lat: 47.37, t: 0 }], [])).toEqual({
      laps: [],
      partialAttempts: [],
    });
  });
});
