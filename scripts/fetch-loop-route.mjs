// Holt eine Rundfahrt-Geometrie inkl. Tempolimits über die Mapbox
// Directions API (echtes Strassenrouting über mehrere Wegpunkte zurück zum
// Start — die Overpass+Dijkstra-Pipeline ist für Punkt-zu-Punkt-Pässe
// gebaut, nicht für Schleifen mit Hin-/Rückweg über unterschiedliche
// Strassen).
//
// Nutzung: node scripts/fetch-loop-route.mjs <key>
// Liest MAPBOX_TOKEN aus .env.local, Wegpunkte aus LOOPS unten.
// Ergebnis: scripts/output/<key>.geojson + <key>.tempolimits.json

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LOOPS = {
  "zimmerberg-rundfahrt": {
    // [lon, lat] — Zürich Enge → Sihltal südwärts → Albis → zurück über Adliswil
    waypoints: [
      [8.5307, 47.3628], // Zürich Enge (Start = Ziel)
      [8.5326, 47.2079], // Sihlbrugg
      [8.5192, 47.2352], // Hausen am Albis
      [8.5245, 47.3103], // Adliswil
      [8.5307, 47.3628], // zurück nach Zürich Enge
    ],
    expectedKm: 55,
  },
};

function haversine([lon1, lat1], [lon2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function loadMapboxToken() {
  const env = await readFile(".env.local", "utf8");
  const match = env.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(.+)/);
  if (!match) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN nicht in .env.local gefunden");
  return match[1].trim();
}

async function fetchDirections(waypoints, token) {
  const coords = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&annotations=maxspeed&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox Directions HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.routes?.[0]) throw new Error("Keine Route gefunden");
  return json.routes[0];
}

// Annotation.maxspeed liefert einen Eintrag pro Geometrie-Segment
// (coordinates.length - 1), einzeln je Leg. Wir hängen die Legs aneinander
// und mergen aufeinanderfolgende gleiche Werte zu Abschnitten.
function buildSpeedSegments(coords, legs) {
  const perSegmentKmh = [];
  for (const leg of legs) {
    for (const entry of leg.annotation?.maxspeed ?? []) {
      if (entry.unknown || entry.speed === undefined) {
        perSegmentKmh.push({ kmh: 80, bekannt: false });
      } else {
        const kmh = entry.unit === "mph" ? Math.round(entry.speed * 1.60934) : entry.speed;
        perSegmentKmh.push({ kmh, bekannt: true });
      }
    }
  }

  const segments = [];
  let cumKm = 0;
  let current = null;

  for (let i = 0; i < perSegmentKmh.length; i++) {
    const distKm = haversine(coords[i], coords[i + 1]) / 1000;
    const speed = perSegmentKmh[i];

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

async function main() {
  const key = process.argv[2];
  const loop = LOOPS[key];
  if (!loop) throw new Error(`Unbekannter Loop-Key: ${key}`);

  const token = await loadMapboxToken();
  const route = await fetchDirections(loop.waypoints, token);
  const coords = route.geometry.coordinates;
  const speedSegments = buildSpeedSegments(coords, route.legs);

  const lengthKm = route.distance / 1000;
  const avgKmh = Math.round(
    speedSegments.reduce((sum, s) => sum + s.kmh * (s.km_bis - s.km_von), 0) / lengthKm,
  );

  console.table([
    {
      key,
      points: coords.length,
      lengthKm: Number(lengthKm.toFixed(1)),
      expectedKm: loop.expectedKm,
      avgKmh,
      segments: speedSegments.length,
    },
  ]);

  const geojson = {
    type: "Feature",
    properties: { key },
    geometry: { type: "LineString", coordinates: coords },
  };
  await writeFile(path.join("scripts/output", `${key}.geojson`), JSON.stringify(geojson));
  await writeFile(
    path.join("scripts/output", `${key}.tempolimits.json`),
    JSON.stringify(speedSegments),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
