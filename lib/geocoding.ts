interface MapboxGeocodeFeature {
  text: string;
  place_type: string[];
  context?: { id: string; text: string }[];
}

interface MapboxGeocodeResponse {
  features?: MapboxGeocodeFeature[];
}

export interface ReverseGeocodeResult {
  ort: string;
  region: string;
}

// Prioritätsreihenfolge für den "Ort"-Treffer — von der feinsten zur
// gröbsten Auflösung. Auf abgelegenen Alpenpässen liefert Mapbox oft keinen
// "locality"/"place"-Treffer im engeren Sinne, aber noch einen "district"
// oder zumindest "region" — besser als gar keinen Namen (Koordinaten-
// Fallback), auch wenn er weniger präzise ist.
const ORT_TYPES_BY_PRIORITY = ["locality", "place", "neighborhood", "district", "region"];

function pickOrtFeature(features: MapboxGeocodeFeature[]): MapboxGeocodeFeature | undefined {
  for (const type of ORT_TYPES_BY_PRIORITY) {
    const match = features.find((f) => f.place_type.includes(type));
    if (match) return match;
  }
  return undefined;
}

// Ermittelt Ortsname + Region aus einer Koordinate (Mapbox Geocoding API,
// derselbe Access Token wie für Directions/Karte) — ersetzt die manuelle
// Eingabe von Start-/Ziel-Ort und Region beim Streckenvorschlag, siehe
// deriveRouteLocations() unten.
export async function reverseGeocode(
  [lon, lat]: [number, number],
): Promise<ReverseGeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
    `?types=locality,place,neighborhood,district,region&language=de&access_token=${token}`;

  let json: MapboxGeocodeResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  const features = json.features ?? [];
  const ortFeature = pickOrtFeature(features);
  if (!ortFeature) return null;

  const regionFeature =
    features.find((f) => f.place_type.includes("region")) ??
    ortFeature.context?.find((c) => c.id.startsWith("region"));

  return {
    ort: ortFeature.text,
    region: regionFeature?.text ?? ortFeature.text,
  };
}

// Fallback, falls das Geocoding fehlschlägt (Netzwerk/Rate-Limit/kein
// Treffer) — die Koordinate als Text, damit die NOT-NULL-Spalten nie leer
// bleiben. Ein Moderator kann den Wert bei der Freigabe korrigieren
// (EditRouteForm).
export function formatCoordFallback([lon, lat]: [number, number]): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

export interface RouteLocations {
  startOrt: string;
  zielOrt: string;
  region: string;
}

type Geocoder = (coord: [number, number]) => Promise<ReverseGeocodeResult | null>;

// Leitet Start-/Zielort und Region aus den Endpunkten einer Routen-Geometrie
// ab — als eigene, von Supabase unabhängige Funktion extrahiert, damit die
// Rundfahrt-/Fallback-Logik isoliert testbar ist (siehe geocoding.test.ts),
// statt nur eingebettet in proposeRoute() (lib/actions/routes.ts) zu leben.
// Bei einer Rundfahrt ist der letzte Punkt identisch mit dem ersten (siehe
// NeueStreckeForm, das den Startpunkt beim Schliessen der Route anhängt) —
// ein zweiter Geocoding-Aufruf für den Zielpunkt wäre dann redundant.
export async function deriveRouteLocations(
  coordinates: [number, number][],
  geocode: Geocoder = reverseGeocode,
): Promise<RouteLocations> {
  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1];
  const isLoop = startCoord[0] === endCoord[0] && startCoord[1] === endCoord[1];

  const [startGeo, endGeo] = await Promise.all([
    geocode(startCoord),
    isLoop ? Promise.resolve(null) : geocode(endCoord),
  ]);

  const startOrt = startGeo?.ort ?? formatCoordFallback(startCoord);
  const zielOrt = isLoop ? startOrt : (endGeo?.ort ?? formatCoordFallback(endCoord));
  const region = startGeo?.region ?? startOrt;

  return { startOrt, zielOrt, region };
}
