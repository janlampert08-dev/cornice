import { describe, expect, it } from "vitest";
import { applyAdvancedFilters, countActiveFilters, EMPTY_ADVANCED_FILTERS } from "@/lib/exploreFilters";
import type { RouteGeoJSON } from "@/types/database";

function makeRoute(overrides: Partial<RouteGeoJSON> = {}): RouteGeoJSON {
  return {
    id: "test-id",
    name: "Julierpass",
    region: "Graubünden",
    start_ort: "Tiefencastel",
    ziel_ort: "Silvaplana",
    start_geojson: { type: "Point", coordinates: [9.5, 46.65] },
    ziel_geojson: { type: "Point", coordinates: [9.8, 46.47] },
    geometry_geojson: { type: "LineString", coordinates: [[9.5, 46.65], [9.8, 46.47]] },
    hoehe_m: 2283,
    laenge_km: 37.9,
    max_steigung_prozent: 12,
    kehren: 26,
    kategorien: ["passstrasse"],
    saison_status: "saisonal",
    status_ok: true,
    charakter_text: null,
    tempolimits: null,
    hoehenprofil: null,
    ist_rundfahrt: false,
    erstellt_von: null,
    created_at: new Date().toISOString(),
    ist_privat: false,
    ...overrides,
  };
}

describe("applyAdvancedFilters", () => {
  it("returns every route unchanged when no filter is set", () => {
    const routes = [makeRoute({ id: "a" }), makeRoute({ id: "b" })];
    expect(applyAdvancedFilters(routes, EMPTY_ADVANCED_FILTERS)).toEqual(routes);
  });

  it("filters by distance range inclusively", () => {
    const routes = [
      makeRoute({ id: "short", laenge_km: 10 }),
      makeRoute({ id: "mid", laenge_km: 30 }),
      makeRoute({ id: "long", laenge_km: 60 }),
    ];
    const result = applyAdvancedFilters(routes, { ...EMPTY_ADVANCED_FILTERS, minKm: 10, maxKm: 30 });
    expect(result.map((r) => r.id)).toEqual(["short", "mid"]);
  });

  it("filters by elevation range, treating null hoehe_m as 0", () => {
    const routes = [
      makeRoute({ id: "flat", hoehe_m: null }),
      makeRoute({ id: "hilly", hoehe_m: 1500 }),
      makeRoute({ id: "alpine", hoehe_m: 2500 }),
    ];
    const result = applyAdvancedFilters(routes, { ...EMPTY_ADVANCED_FILTERS, minHoehe: 1000 });
    expect(result.map((r) => r.id)).toEqual(["hilly", "alpine"]);
  });

  it("keeps only year-round routes when nurGanzjaehrig is set", () => {
    const routes = [
      makeRoute({ id: "seasonal", saison_status: "saisonal" }),
      makeRoute({ id: "yearround", saison_status: "ganzjaehrig" }),
    ];
    const result = applyAdvancedFilters(routes, { ...EMPTY_ADVANCED_FILTERS, nurGanzjaehrig: true });
    expect(result.map((r) => r.id)).toEqual(["yearround"]);
  });

  it("combines all active filters with AND", () => {
    const routes = [
      makeRoute({ id: "matches", laenge_km: 20, hoehe_m: 1500, saison_status: "ganzjaehrig" }),
      makeRoute({ id: "too-long", laenge_km: 80, hoehe_m: 1500, saison_status: "ganzjaehrig" }),
      makeRoute({ id: "seasonal", laenge_km: 20, hoehe_m: 1500, saison_status: "saisonal" }),
    ];
    const result = applyAdvancedFilters(routes, {
      minKm: 10,
      maxKm: 30,
      minHoehe: 1000,
      maxHoehe: null,
      nurGanzjaehrig: true,
    });
    expect(result.map((r) => r.id)).toEqual(["matches"]);
  });
});

describe("countActiveFilters", () => {
  it("counts zero for the empty filter set", () => {
    expect(countActiveFilters(EMPTY_ADVANCED_FILTERS)).toBe(0);
  });

  it("counts each set field once", () => {
    expect(countActiveFilters({ minKm: 5, maxKm: null, minHoehe: null, maxHoehe: 2000, nurGanzjaehrig: true })).toBe(3);
  });
});
