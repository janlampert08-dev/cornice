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

// Ermittelt Ortsname + Region aus einer Koordinate (Mapbox Geocoding API,
// derselbe Access Token wie für Directions/Karte) — ersetzt die manuelle
// Eingabe von Start-/Ziel-Ort und Region beim Streckenvorschlag, siehe
// proposeRoute() in lib/actions/routes.ts.
export async function reverseGeocode(
  [lon, lat]: [number, number],
): Promise<ReverseGeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
    `?types=place,locality,region&language=de&access_token=${token}`;

  let json: MapboxGeocodeResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  const features = json.features ?? [];
  const ortFeature = features.find(
    (f) => f.place_type.includes("place") || f.place_type.includes("locality"),
  );
  if (!ortFeature) return null;

  const regionFeature =
    features.find((f) => f.place_type.includes("region")) ??
    ortFeature.context?.find((c) => c.id.startsWith("region"));

  return {
    ort: ortFeature.text,
    region: regionFeature?.text ?? ortFeature.text,
  };
}

// Fallback, falls das Geocoding fehlschlägt (Netzwerk/Rate-Limit) — die
// Koordinate als Text, damit die NOT-NULL-Spalten nie leer bleiben. Ein
// Moderator kann den Wert bei der Freigabe korrigieren (EditRouteForm).
export function formatCoordFallback([lon, lat]: [number, number]): string {
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}
