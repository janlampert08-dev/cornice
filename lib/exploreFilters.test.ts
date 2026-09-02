import { describe, expect, it } from "vitest";
import {
  applyAdvancedFilters,
  countActiveFilters,
  EMPTY_ADVANCED_FILTERS,
  EMPTY_EXPLORE_FILTERS_STATE,
  parseExploreSearchParams,
  serializeExploreSearchParams,
  type ExploreFiltersState,
} from "@/lib/exploreFilters";
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

describe("parseExploreSearchParams", () => {
  it("defaults to the empty state for an empty query string", () => {
    expect(parseExploreSearchParams(new URLSearchParams())).toEqual(EMPTY_EXPLORE_FILTERS_STATE);
  });

  it("reads a fully populated query string", () => {
    const params = new URLSearchParams(
      "q=Julier&kat=kurvig,passstrasse&minKm=10&maxKm=50&minHoehe=500&maxHoehe=2500&ganzjaehrig=1",
    );
    expect(parseExploreSearchParams(params)).toEqual({
      searchQuery: "Julier",
      selectedKategorien: ["kurvig", "passstrasse"],
      advancedFilters: {
        minKm: 10,
        maxKm: 50,
        minHoehe: 500,
        maxHoehe: 2500,
        nurGanzjaehrig: true,
      },
    });
  });

  it("drops unknown category values instead of throwing", () => {
    const params = new URLSearchParams("kat=kurvig,nonsense,passstrasse");
    expect(parseExploreSearchParams(params).selectedKategorien).toEqual(["kurvig", "passstrasse"]);
  });

  it("dedupes repeated category values", () => {
    const params = new URLSearchParams("kat=kurvig,kurvig,scenic");
    expect(parseExploreSearchParams(params).selectedKategorien).toEqual(["kurvig", "scenic"]);
  });

  it("treats non-numeric or blank numeric params as unset (null)", () => {
    const params = new URLSearchParams("minKm=abc&maxKm=&minHoehe=NaN");
    const result = parseExploreSearchParams(params);
    expect(result.advancedFilters.minKm).toBeNull();
    expect(result.advancedFilters.maxKm).toBeNull();
    expect(result.advancedFilters.minHoehe).toBeNull();
  });

  it("treats anything other than ganzjaehrig=1 as false", () => {
    expect(parseExploreSearchParams(new URLSearchParams("ganzjaehrig=true")).advancedFilters.nurGanzjaehrig).toBe(
      false,
    );
    expect(parseExploreSearchParams(new URLSearchParams("ganzjaehrig=0")).advancedFilters.nurGanzjaehrig).toBe(
      false,
    );
  });
});

describe("serializeExploreSearchParams", () => {
  it("produces an empty query string for the empty state", () => {
    expect(serializeExploreSearchParams(EMPTY_EXPLORE_FILTERS_STATE).toString()).toBe("");
  });

  it("omits blank/whitespace-only search text", () => {
    expect(
      serializeExploreSearchParams({ ...EMPTY_EXPLORE_FILTERS_STATE, searchQuery: "   " }).toString(),
    ).toBe("");
  });

  it("serializes a fully populated state", () => {
    const state: ExploreFiltersState = {
      searchQuery: "Julier",
      selectedKategorien: ["kurvig", "passstrasse"],
      advancedFilters: {
        minKm: 10,
        maxKm: 50,
        minHoehe: 500,
        maxHoehe: 2500,
        nurGanzjaehrig: true,
      },
    };
    const params = serializeExploreSearchParams(state);
    expect(params.get("q")).toBe("Julier");
    expect(params.get("kat")).toBe("kurvig,passstrasse");
    expect(params.get("minKm")).toBe("10");
    expect(params.get("maxKm")).toBe("50");
    expect(params.get("minHoehe")).toBe("500");
    expect(params.get("maxHoehe")).toBe("2500");
    expect(params.get("ganzjaehrig")).toBe("1");
  });

  it("round-trips through parseExploreSearchParams", () => {
    const state: ExploreFiltersState = {
      searchQuery: "Furka",
      selectedKategorien: ["scenic", "freie_fahrt"],
      advancedFilters: { minKm: 5, maxKm: null, minHoehe: null, maxHoehe: 3000, nurGanzjaehrig: false },
    };
    const roundTripped = parseExploreSearchParams(serializeExploreSearchParams(state));
    expect(roundTripped).toEqual(state);
  });

  it("round-trips the empty state back to itself", () => {
    const roundTripped = parseExploreSearchParams(serializeExploreSearchParams(EMPTY_EXPLORE_FILTERS_STATE));
    expect(roundTripped).toEqual(EMPTY_EXPLORE_FILTERS_STATE);
  });
});
