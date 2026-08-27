import { haversineKm } from "@/lib/geo";
import type { TempolimitSegment } from "@/types/database";

export interface DirectionsResult {
  coordinates: [number, number][];
  distanceKm: number;
  tempolimits: TempolimitSegment[];
}

interface MapboxMaxspeedEntry {
  speed?: number;
  unit?: "km/h" | "mph";
  unknown?: boolean;
  none?: boolean;
}

interface MapboxLeg {
  annotation?: { maxspeed?: MapboxMaxspeedEntry[] };
}

function buildSpeedSegments(
  coords: [number, number][],
  legs: MapboxLeg[],
): TempolimitSegment[] {
  const perSegment: { kmh: number; bekannt: boolean }[] = [];
  for (const leg of legs) {
    for (const entry of leg.annotation?.maxspeed ?? []) {
      if (entry.unknown || entry.none || entry.speed === undefined) {
        perSegment.push({ kmh: 80, bekannt: false });
      } else {
        const kmh = entry.unit === "mph" ? Math.round(entry.speed * 1.60934) : entry.speed;
        perSegment.push({ kmh, bekannt: true });
      }
    }
  }

  const segments: TempolimitSegment[] = [];
  let cumKm = 0;
  let current: TempolimitSegment | null = null;

  for (let i = 0; i < perSegment.length && i < coords.length - 1; i++) {
    const distKm = haversineKm(coords[i], coords[i + 1]);
    const speed = perSegment[i];

    if (current && current.kmh === speed.kmh && current.bekannt === speed.bekannt) {
      current.km_bis = Number((cumKm + distKm).toFixed(2));
    } else {
      current = {
        km_von: Number(cumKm.toFixed(2)),
        km_bis: Number((cumKm + distKm).toFixed(2)),
        kmh: speed.kmh,
        bekannt: speed.bekannt,
      };
      segments.push(current);
    }
    cumKm += distKm;
  }

  return segments;
}

// Ruft die Mapbox Directions API auf, um Wegpunkte zu einer echten,
// strassenfolgenden Route zu verbinden (statt Luftlinie) — inkl.
// Tempolimit-Annotationen für dieselbe Geometrie.
export async function fetchDrivingRoute(
  waypoints: [number, number][],
): Promise<DirectionsResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || waypoints.length < 2) return null;

  const coordsParam = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsParam}` +
    `?geometries=geojson&overview=full&annotations=maxspeed&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return null;

  const coordinates: [number, number][] = route.geometry.coordinates;
  return {
    coordinates,
    distanceKm: route.distance / 1000,
    tempolimits: buildSpeedSegments(coordinates, route.legs ?? []),
  };
}
