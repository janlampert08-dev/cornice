import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveRouteLocations, formatCoordFallback, reverseGeocode } from "@/lib/geocoding";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

afterEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }),
  );
}

describe("formatCoordFallback", () => {
  it("formats as 'lat, lon' with 3 decimals", () => {
    expect(formatCoordFallback([8.5417, 47.3769])).toBe("47.377, 8.542");
  });
});

describe("reverseGeocode", () => {
  it("returns null without a Mapbox token", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "";
    expect(await reverseGeocode([8.5417, 47.3769])).toBeNull();
  });

  it("returns null when the request fails", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "dummy";
    mockFetchOnce({}, false);
    expect(await reverseGeocode([8.5417, 47.3769])).toBeNull();
  });

  it("returns null on a network error", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "dummy";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await reverseGeocode([8.5417, 47.3769])).toBeNull();
  });

  it("returns null when no usable feature is in the response", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "dummy";
    mockFetchOnce({ features: [{ text: "Schweiz", place_type: ["country"] }] });
    expect(await reverseGeocode([8.5417, 47.3769])).toBeNull();
  });

  it("prefers the locality/place feature and its region context", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "dummy";
    mockFetchOnce({
      features: [
        {
          text: "Zürich",
          place_type: ["place"],
          context: [{ id: "region.123", text: "Zürich" }],
        },
        { text: "Zürich", place_type: ["region"] },
      ],
    });
    expect(await reverseGeocode([8.5417, 47.3769])).toEqual({ ort: "Zürich", region: "Zürich" });
  });

  it("falls back to a coarser district/region feature on remote coordinates", async () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "dummy";
    mockFetchOnce({
      features: [{ text: "Uri", place_type: ["region"] }],
    });
    expect(await reverseGeocode([8.6, 46.7])).toEqual({ ort: "Uri", region: "Uri" });
  });
});

describe("deriveRouteLocations", () => {
  const startCoord: [number, number] = [8.5, 47.3];
  const endCoord: [number, number] = [9.0, 46.9];

  it("looks up start and end independently for a non-loop route", async () => {
    const geocode = vi
      .fn()
      .mockResolvedValueOnce({ ort: "Zürich", region: "Zürich" })
      .mockResolvedValueOnce({ ort: "Chur", region: "Graubünden" });

    const result = await deriveRouteLocations([startCoord, endCoord], geocode);

    expect(geocode).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ startOrt: "Zürich", zielOrt: "Chur", region: "Zürich" });
  });

  it("skips the second lookup for a loop route (start === end)", async () => {
    const geocode = vi.fn().mockResolvedValue({ ort: "Andermatt", region: "Uri" });

    const result = await deriveRouteLocations([startCoord, [0, 0], startCoord], geocode);

    expect(geocode).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ startOrt: "Andermatt", zielOrt: "Andermatt", region: "Uri" });
  });

  it("falls back to coordinate text per endpoint when geocoding fails", async () => {
    const geocode = vi.fn().mockResolvedValue(null);

    const result = await deriveRouteLocations([startCoord, endCoord], geocode);

    expect(result).toEqual({
      startOrt: formatCoordFallback(startCoord),
      zielOrt: formatCoordFallback(endCoord),
      region: formatCoordFallback(startCoord),
    });
  });
});
