import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl } from "@/lib/googleMaps";
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
    geometry_geojson: {
      type: "LineString",
      coordinates: [
        [9.5, 46.65],
        [9.6, 46.6],
        [9.7, 46.55],
        [9.8, 46.47],
      ],
    },
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

describe("buildGoogleMapsUrl", () => {
  it("builds a directions URL with lat,lon origin/destination in that order", () => {
    const url = buildGoogleMapsUrl(makeRoute());
    const params = new URL(url).searchParams;
    expect(params.get("origin")).toBe("46.65,9.5");
    expect(params.get("destination")).toBe("46.47,9.8");
    expect(params.get("travelmode")).toBe("driving");
  });

  it("includes intermediate waypoints for a multi-point geometry", () => {
    const url = buildGoogleMapsUrl(makeRoute());
    const params = new URL(url).searchParams;
    expect(params.get("waypoints")).toBeTruthy();
  });

  it("omits waypoints when the geometry has no intermediate points", () => {
    const url = buildGoogleMapsUrl(
      makeRoute({
        geometry_geojson: {
          type: "LineString",
          coordinates: [
            [9.5, 46.65],
            [9.8, 46.47],
          ],
        },
      }),
    );
    const params = new URL(url).searchParams;
    expect(params.has("waypoints")).toBe(false);
  });
});
