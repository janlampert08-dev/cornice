import type { RouteGeoJSON } from "@/types/database";

// Baut eine Google-Maps-Directions-URL mit ein paar Zwischenpunkten aus der
// echten Streckengeometrie, damit die Route grob dem tatsächlichen
// Strassenverlauf folgt statt einer Luftlinie Start→Ziel.
export function buildGoogleMapsUrl(route: RouteGeoJSON): string {
  const coords = route.geometry_geojson.coordinates;
  const start = route.start_geojson.coordinates;
  const end = route.ziel_geojson.coordinates;

  const maxWaypoints = 8;
  const waypoints: [number, number][] = [];
  if (coords.length > 2) {
    const step = Math.max(1, Math.floor(coords.length / (maxWaypoints + 1)));
    for (let i = step; i < coords.length - 1 && waypoints.length < maxWaypoints; i += step) {
      waypoints.push(coords[i] as [number, number]);
    }
  }

  const toLatLng = ([lon, lat]: [number, number]) => `${lat},${lon}`;
  const params = new URLSearchParams({
    api: "1",
    origin: toLatLng(start),
    destination: toLatLng(end),
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(toLatLng).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
