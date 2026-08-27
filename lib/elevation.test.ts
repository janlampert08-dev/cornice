import { describe, expect, it } from "vitest";
import {
  buildHoehenprofil,
  computeHoeheUndSteigung,
  countKehren,
  interpolateElevation,
} from "@/lib/elevation";

describe("computeHoeheUndSteigung", () => {
  it("finds the peak elevation and a plausible grade for a constant 10% ramp", () => {
    const profile = Array.from({ length: 11 }, (_, i) => ({
      dist: i * 100,
      elevation: 1000 + i * 100 * 0.1,
    }));
    const { hoeheM, maxSteigungProzent } = computeHoeheUndSteigung(profile);
    expect(hoeheM).toBe(1100);
    expect(maxSteigungProzent).toBeCloseTo(10, 0);
  });

  it("returns 0 grade for a flat profile", () => {
    const profile = Array.from({ length: 11 }, (_, i) => ({ dist: i * 100, elevation: 500 }));
    const { maxSteigungProzent } = computeHoeheUndSteigung(profile);
    expect(maxSteigungProzent).toBe(0);
  });
});

describe("buildHoehenprofil", () => {
  it("always includes the final point of the profile", () => {
    const profile = Array.from({ length: 50 }, (_, i) => ({ dist: i * 100, elevation: 1000 + i }));
    const points = buildHoehenprofil(profile, 10);
    const last = points[points.length - 1];
    expect(last.km).toBeCloseTo(profile[profile.length - 1].dist / 1000, 2);
  });

  it("downsamples to roughly the requested point count", () => {
    const profile = Array.from({ length: 300 }, (_, i) => ({ dist: i * 10, elevation: 1000 }));
    const points = buildHoehenprofil(profile, 80);
    expect(points.length).toBeLessThan(150);
    expect(points.length).toBeGreaterThan(10);
  });
});

describe("countKehren", () => {
  it("finds no hairpins on a straight line", () => {
    const straight: [number, number][] = Array.from({ length: 20 }, (_, i) => [
      8.0 + i * 0.0003,
      47.0,
    ]);
    expect(countKehren(straight)).toBe(0);
  });

  it("detects a single hairpin on a smooth 180° switchback", () => {
    // Local flat-earth projection (metres -> degrees) near 47°N, good enough
    // for a small synthetic geometry a few hundred metres across.
    const lat0 = 47.0;
    const lon0 = 8.0;
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const toLonLat = (x: number, y: number): [number, number] => [
      lon0 + x / mPerDegLon,
      lat0 + y / mPerDegLat,
    ];

    const radius = 25;
    const points: [number, number][] = [];
    // Straight approach heading east into the bend.
    for (let x = -100; x <= 0; x += 20) points.push(toLonLat(x, 0));
    // Smooth semicircular switchback (continuous curvature, not a sharp V).
    for (let deg = 15; deg < 180; deg += 15) {
      const theta = (deg * Math.PI) / 180;
      points.push(toLonLat(radius * Math.sin(theta), radius - radius * Math.cos(theta)));
    }
    // Straight exit heading west away from the bend.
    for (let x = -20; x >= -100; x -= 20) points.push(toLonLat(x, 2 * radius));

    expect(countKehren(points)).toBe(1);
  });

  it("returns 0 for a path too short to resample into a full window", () => {
    expect(countKehren([[8.0, 47.0], [8.001, 47.0]])).toBe(0);
  });
});

describe("interpolateElevation", () => {
  const profil = [
    { km: 0, m: 500 },
    { km: 5, m: 1000 },
    { km: 10, m: 800 },
  ];

  it("returns null for an empty profile", () => {
    expect(interpolateElevation([], 3)).toBeNull();
  });

  it("clamps to the first point before the route starts", () => {
    expect(interpolateElevation(profil, -1)).toBe(500);
  });

  it("clamps to the last point past the route end", () => {
    expect(interpolateElevation(profil, 99)).toBe(800);
  });

  it("linearly interpolates between two bracketing points", () => {
    // Halfway between km 0 (500m) and km 5 (1000m) -> 750m.
    expect(interpolateElevation(profil, 2.5)).toBe(750);
  });

  it("returns the exact value at a known point", () => {
    expect(interpolateElevation(profil, 5)).toBe(1000);
  });
});
