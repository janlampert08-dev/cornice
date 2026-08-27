import { createClient } from "@/lib/supabase/server";
import type { PublicFahrt, Vehicle } from "@/types/database";

export interface PublicProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  zeigtAvatar: boolean;
  zeigtFahrzeuge: boolean;
  zeigtPaesse: boolean;
  zeigtHoehenmeter: boolean;
  zeigtDistanz: boolean;
  // true nur wenn beides zutrifft: ist_premium UND das eigene Opt-in
  // zeigt_premium_badge — siehe 0021_premium_und_private_strecken.sql.
  zeigtPremiumBadge: boolean;
  vehicles: Vehicle[];
  fahrten: PublicFahrt[];
  passCount: number;
  hoehenmeter: number;
  distanzKm: number;
}

// Fahrzeuge werden nur befüllt, wenn der Nutzer das per Profileinstellung
// freigegeben hat. Fahrten kommen direkt aus public_fahrten (0017/0018) —
// die View filtert bereits auf ist_oeffentlich=true pro Fahrt. Die
// zusammenfassenden Kennzahlen (Pässe/Höhenmeter/Distanz) werden IMMER aus
// diesen Fahrten berechnet, aber nur je nach eigenem Opt-in ausgegeben —
// so kann jemand einzelne Fahrten teilen, ohne automatisch seine
// Lebenszeit-Summen preiszugeben.
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, zeigt_fahrzeuge, zeigt_avatar, zeigt_paesse, zeigt_hoehenmeter, zeigt_distanz, ist_premium, zeigt_premium_badge",
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const [vehiclesResult, fahrtenResult] = await Promise.all([
    profile.zeigt_fahrzeuge
      ? supabase.from("vehicles").select("*").eq("user_id", userId)
      : Promise.resolve({ data: [] as Vehicle[] }),
    supabase.from("public_fahrten").select("*").eq("user_id", userId),
  ]);

  const fahrten = (fahrtenResult.data as PublicFahrt[]) ?? [];
  const passCount = new Set(fahrten.map((f) => f.route_id)).size;
  const distanzKm = fahrten.reduce((sum, f) => sum + (f.distanz_km ?? 0), 0);

  let hoehenmeter = 0;
  if (fahrten.length > 0) {
    const routeIds = [...new Set(fahrten.map((f) => f.route_id))];
    const { data: routes } = await supabase
      .from("routes")
      .select("id, hoehe_m")
      .in("id", routeIds);
    const hoeheById = new Map((routes ?? []).map((r) => [r.id, r.hoehe_m ?? 0]));
    hoehenmeter = fahrten.reduce((sum, f) => sum + (hoeheById.get(f.route_id) ?? 0), 0);
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    zeigtAvatar: profile.zeigt_avatar,
    zeigtFahrzeuge: profile.zeigt_fahrzeuge,
    zeigtPaesse: profile.zeigt_paesse,
    zeigtHoehenmeter: profile.zeigt_hoehenmeter,
    zeigtDistanz: profile.zeigt_distanz,
    zeigtPremiumBadge: profile.ist_premium && profile.zeigt_premium_badge,
    vehicles: (vehiclesResult.data as Vehicle[]) ?? [],
    fahrten,
    passCount,
    hoehenmeter,
    distanzKm,
  };
}
