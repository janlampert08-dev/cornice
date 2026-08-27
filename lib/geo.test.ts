import { describe, expect, it } from "vitest";
import {
  averageTempolimit,
  estimateApproachMinutes,
  estimateRouteDurationMinutes,
  formatMinutes,
  haversineKm,
} from "@/lib/geo";
import type { TempolimitSegment } from "@/types/database";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm([8.5, 47.3], [8.5, 47.3])).toBe(0);
  });

  it("computes the known distance between Zürich and Bern (~95km)", () => {
    const zuerich: [number, number] = [8.5417, 47.3769];
    const bern: [number, number] = [7.4474, 46.948];
    const km = haversineKm(zuerich, bern);
    expect(km).toBeGreaterThan(90);
    expect(km).toBeLessThan(100);
  });
});

describe("estimateApproachMinutes", () => {
  it("scales with distance", () => {
    expect(estimateApproachMinutes(50)).toBeGreaterThan(estimateApproachMinutes(10));
  });

  it("applies the road detour factor over an air-line distance", () => {
    // 50km air-line * 1.3 detour / 50km/h * 60 = 78 min
    expect(estimateApproachMinutes(50)).toBe(78);
  });
});

describe("averageTempolimit", () => {
  it("returns null for empty/missing segments", () => {
    expect(averageTempolimit(null)).toBeNull();
    expect(averageTempolimit([])).toBeNull();
  });

  it("computes a length-weighted average", () => {
    const segments: TempolimitSegment[] = [
      { km_von: 0, km_bis: 8, kmh: 80, bekannt: true },
      { km_von: 8, km_bis: 10, kmh: 30, bekannt: true },
    ];
    // (8*80 + 2*30) / 10 = 70
    expect(averageTempolimit(segments)).toBe(70);
  });
});

describe("estimateRouteDurationMinutes", () => {
  it("uses real tempolimit data when available", () => {
    const segments: TempolimitSegment[] = [{ km_von: 0, km_bis: 40, kmh: 80, bekannt: true }];
    const minutes = estimateRouteDurationMinutes(40, ["passstrasse"], segments);
    // 40km / (80*0.8) km/h * 60 = 37.5 -> 38
    expect(minutes).toBe(38);
  });

  it("falls back to a category heuristic without tempolimit data", () => {
    const kurvig = estimateRouteDurationMinutes(35, ["kurvig"], null);
    const freieFahrt = estimateRouteDurationMinutes(35, ["freie_fahrt"], null);
    expect(kurvig).toBeGreaterThan(freieFahrt);
  });
});

describe("formatMinutes", () => {
  it("formats sub-hour durations as minutes only", () => {
    expect(formatMinutes(45)).toBe("45 min");
  });

  it("formats exact hours without a minutes remainder", () => {
    expect(formatMinutes(120)).toBe("2 h");
  });

  it("formats hours with a minutes remainder", () => {
    expect(formatMinutes(125)).toBe("2 h 5 min");
  });
});
