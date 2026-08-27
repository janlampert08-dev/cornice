import { describe, expect, it } from "vitest";
import { buildGpx, gpxFileName } from "@/lib/gpx";
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

describe("buildGpx", () => {
  it("includes a track point for every geometry coordinate", () => {
    const gpx = buildGpx(makeRoute());
    const matches = gpx.match(/<trkpt/g) ?? [];
    expect(matches).toHaveLength(3);
  });

  it("includes both a start and end waypoint for point-to-point routes", () => {
    const gpx = buildGpx(makeRoute({ ist_rundfahrt: false }));
    expect(gpx).toContain("<name>Start</name>");
    expect(gpx).toContain("<name>Ziel</name>");
  });

  it("includes only a start waypoint for loop routes", () => {
    const gpx = buildGpx(makeRoute({ ist_rundfahrt: true }));
    expect(gpx).toContain("<name>Start</name>");
    expect(gpx).not.toContain("<name>Ziel</name>");
  });

  it("escapes XML-sensitive characters in the route name", () => {
    const gpx = buildGpx(makeRoute({ name: 'Pass "A" & B' }));
    expect(gpx).toContain("Pass &quot;A&quot; &amp; B");
    expect(gpx).not.toContain('"A"');
  });
});

describe("gpxFileName", () => {
  it("slugifies the route name", () => {
    expect(gpxFileName("Julierpass")).toBe("julierpass.gpx");
  });

  it("transliterates German umlauts instead of dropping them", () => {
    expect(gpxFileName("Flüelapass")).toBe("flueelapass.gpx");
    expect(gpxFileName("Zürich")).toBe("zuerich.gpx");
  });

  it("replaces non-alphanumeric runs with a single hyphen", () => {
    expect(gpxFileName("Test-Rundfahrt Zürichsee!")).toBe("test-rundfahrt-zuerichsee.gpx");
  });

  it("falls back to a generic name for an empty slug", () => {
    expect(gpxFileName("???")).toBe("strecke.gpx");
  });
});
