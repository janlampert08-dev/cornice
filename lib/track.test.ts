import { describe, expect, it } from "vitest";
import {
  MAX_JUMP_KM,
  maxJumpKm,
  movingSeconds,
  simplifyTrack,
  toEwktLineString,
} from "@/lib/track";
import { computeTrailStats, type TrailPoint } from "@/lib/geo";

// Punkte entlang eines Ost-West-Verlaufs auf 47.37° N. Ein Grad Länge sind
// dort rund 75 km, 0.001° also etwa 75 m.
function point(lng: number, lat: number, seconds: number): TrailPoint {
  return { lng, lat, t: seconds * 1000 };
}

function straightLine(count: number, stepDeg = 0.001, secondsPerStep = 10): TrailPoint[] {
  return Array.from({ length: count }, (_, i) => point(8.5 + i * stepDeg, 47.37, i * secondsPerStep));
}

describe("simplifyTrack", () => {
  it("keeps tracks with two or fewer points untouched", () => {
    const track = straightLine(2);
    expect(simplifyTrack(track)).toEqual(track);
  });

  it("reduces a straight line to its two endpoints", () => {
    const track = straightLine(50);
    const simplified = simplifyTrack(track);
    expect(simplified).toEqual([track[0], track[track.length - 1]]);
  });

  it("keeps a corner that is further from the chord than the tolerance", () => {
    // Der mittlere Punkt liegt rund 110 m neben der Verbindungsgeraden —
    // deutlich über der Standardtoleranz von 5 m.
    const track = [point(8.5, 47.37, 0), point(8.501, 47.371, 10), point(8.502, 47.37, 20)];
    expect(simplifyTrack(track)).toHaveLength(3);
  });

  it("drops a wobble that stays within the tolerance", () => {
    // 0.00001° Breite sind gut 1 m — unterhalb der Toleranz, also Rauschen.
    const track = [point(8.5, 47.37, 0), point(8.501, 47.37001, 10), point(8.502, 47.37, 20)];
    expect(simplifyTrack(track)).toHaveLength(2);
  });

  it("stays within one percent of the original distance on a curvy track", () => {
    const track = Array.from({ length: 400 }, (_, i) =>
      point(8.5 + i * 0.0005, 47.37 + Math.sin(i / 8) * 0.0008, i * 5),
    );
    const original = computeTrailStats(track).distanceKm;
    const simplified = computeTrailStats(simplifyTrack(track)).distanceKm;
    expect(simplified).toBeGreaterThan(0);
    expect(Math.abs(simplified - original) / original).toBeLessThan(0.01);
  });

  it("does not blow the stack on a long, nearly straight track", () => {
    expect(() => simplifyTrack(straightLine(20_000, 0.00001, 1))).not.toThrow();
  });
});

describe("movingSeconds", () => {
  it("counts the full duration when the ride never stops", () => {
    // 75 m in 10 s sind rund 27 km/h — durchgehend über der Schwelle.
    expect(movingSeconds(straightLine(4))).toBe(30);
  });

  it("ignores segments below the moving threshold", () => {
    const track = [
      point(8.5, 47.37, 0),
      point(8.501, 47.37, 10), // ~27 km/h, zählt
      point(8.501, 47.37, 610), // zehn Minuten Pause am selben Ort
      point(8.502, 47.37, 620), // wieder ~27 km/h, zählt
    ];
    expect(movingSeconds(track)).toBe(20);
    // Die verstrichene Gesamtzeit bleibt davon unberührt.
    expect(computeTrailStats(track).durationSeconds).toBe(620);
  });

  it("ignores points without forward time", () => {
    const track = [point(8.5, 47.37, 10), point(8.501, 47.37, 10)];
    expect(movingSeconds(track)).toBe(0);
  });
});

describe("maxJumpKm", () => {
  it("reports the largest gap between consecutive points", () => {
    const track = [point(8.5, 47.37, 0), point(8.501, 47.37, 10), point(8.6, 47.37, 20)];
    expect(maxJumpKm(track)).toBeGreaterThan(7);
  });

  it("stays below the plausibility limit for a normal recording", () => {
    expect(maxJumpKm(straightLine(20))).toBeLessThan(MAX_JUMP_KM);
  });
});

describe("toEwktLineString", () => {
  it("writes an SRID-tagged line string", () => {
    expect(toEwktLineString(straightLine(2))).toBe(
      "SRID=4326;LINESTRING(8.500000 47.370000,8.501000 47.370000)",
    );
  });

  it("collapses consecutive duplicates", () => {
    const track = [point(8.5, 47.37, 0), point(8.5, 47.37, 10), point(8.501, 47.37, 20)];
    expect(toEwktLineString(track)).toBe(
      "SRID=4326;LINESTRING(8.500000 47.370000,8.501000 47.370000)",
    );
  });

  it("returns null when fewer than two distinct points remain", () => {
    expect(toEwktLineString([point(8.5, 47.37, 0), point(8.5, 47.37, 10)])).toBeNull();
    expect(toEwktLineString([])).toBeNull();
  });
});
