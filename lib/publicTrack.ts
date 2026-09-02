import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PRIVACY_RADIUS_M, cropTrackEnds, toEwktLineString } from "@/lib/track";
import type { GeoLineString } from "@/types/database";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Bewusst kein "use server"-Modul: die Funktionen hier nehmen einen fertigen
// Supabase-Client entgegen und wären als Server Actions ein von aussen
// aufrufbarer Endpunkt. Sie werden ausschliesslich von Server Actions
// (lib/actions/completions.ts, lib/actions/profile.ts) benutzt.

// Der eingestellte Privatzonen-Radius des Nutzers. Fällt auf den Standard
// zurück, wenn das Profil nicht gelesen werden kann — im Zweifel wird
// gekappt, nicht veröffentlicht.
export async function privacyRadiusM(supabase: ServerClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("privatzone_radius_m")
    .eq("id", userId)
    .maybeSingle<{ privatzone_radius_m: number }>();
  return data?.privatzone_radius_m ?? DEFAULT_PRIVACY_RADIUS_M;
}

// Die öffentlich sichtbare Fassung eines Tracks: Anfang und Ende innerhalb
// der Privatzone entfernt (siehe cropTrackEnds). null, wenn danach zu wenig
// übrig bleibt — dann zeigt die Fahrt eben keine Karte, aber niemals eine
// ungekappte.
export async function publicTrackEwkt(
  supabase: ServerClient,
  userId: string,
  coordinates: [number, number][],
): Promise<string | null> {
  const radiusM = await privacyRadiusM(supabase, userId);
  return toEwktLineString(cropTrackEnds(coordinates, radiusM));
}

// Nach einer Änderung des Radius müssen die bereits geteilten Fahrten neu
// gekappt werden — sonst gölte die neue Einstellung nur für künftige
// Fahrten, und genau die alten wären das Problem.
//
// Die Schleife läuft ausdrücklich nur über die öffentlichen Fahrten: private
// tragen gar keinen öffentlichen Track (siehe 0045), und deren Zahl ist pro
// Nutzer klein. Ein einzelnes UPDATE über alle Zeilen ginge nicht, weil die
// Kappung pro Fahrt eine eigene Geometrie ergibt und in SQL nur
// näherungsweise möglich wäre (siehe Migrationskommentar).
export async function recomputePublicTracks(
  supabase: ServerClient,
  userId: string,
  radiusM: number,
): Promise<void> {
  const { data: rides } = await supabase
    .from("route_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("ist_oeffentlich", true)
    .returns<{ id: string }[]>();

  if (!rides || rides.length === 0) return;

  const { data: tracks } = await supabase
    .from("fahrt_tracks")
    .select("completion_id, track_geojson")
    .in(
      "completion_id",
      rides.map((r) => r.id),
    )
    .returns<{ completion_id: string; track_geojson: GeoLineString }[]>();

  for (const row of tracks ?? []) {
    const cropped = cropTrackEnds(row.track_geojson.coordinates, radiusM);
    await supabase
      .from("route_completions")
      .update({ track_oeffentlich: toEwktLineString(cropped) })
      .eq("id", row.completion_id)
      .eq("user_id", userId);
  }
}
