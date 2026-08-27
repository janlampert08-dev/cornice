import { describe, expect, it } from "vitest";
import { computeRouteCoverage } from "@/lib/routeCoverage";

// Gerade Strecke ~2.3km lang (100 Punkte, ~23m Abstand), analog zum
// "straight"-Testfixture in lib/elevation.test.ts.
const route: [number, number][] = Array.from({ length: 101 }, (_, i) => [
  8.0 + i * 0.0003,
  47.0,
]);

describe("computeRouteCoverage", () => {
  it("returns 0 for an empty trail", () => {
    expect(computeRouteCoverage(route, [])).toBe(0);
  });

  it("returns 0 for a route with fewer than two points", () => {
    expect(computeRouteCoverage([[8.0, 47.0]], route)).toBe(0);
  });

  it("returns full coverage when the trail follows the entire route", () => {
    expect(computeRouteCoverage(route, route)).toBe(100);
  });

  it("reports partial coverage for a trail that stops halfway (unfinished/wrong endpoint)", () => {
    const halfTrail = route.slice(0, 51);
    const coverage = computeRouteCoverage(route, halfTrail);
    expect(coverage).toBeGreaterThan(40);
    expect(coverage).toBeLessThan(60);
  });

  it("reports low coverage for a trail that skips the middle (shortcut)", () => {
    const shortcutTrail = [...route.slice(0, 15), ...route.slice(-15)];
    const coverage = computeRouteCoverage(route, shortcutTrail);
    expect(coverage).toBeLessThan(50);
  });

  it("stays near 100 for a trail with minor GPS jitter around the route", () => {
    const jitteredTrail: [number, number][] = route.map(([lon, lat]) => [
      lon + 0.0002,
      lat + 0.0002,
    ]);
    const coverage = computeRouteCoverage(route, jitteredTrail);
    expect(coverage).toBeGreaterThan(70);
  });
});
