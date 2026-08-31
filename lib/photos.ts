import { createClient } from "@/lib/supabase/server";
import type { RoutePhoto } from "@/types/database";

export async function getRoutePhotos(routeId: string): Promise<RoutePhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_photos")
    .select("*")
    .eq("route_id", routeId)
    .order("datum", { ascending: false });

  return (data as RoutePhoto[]) ?? [];
}

type CoverPhotoRow = Pick<RoutePhoto, "route_id" | "foto_url" | "datum">;

// Reine Dedup-Logik, separat testbar (siehe photos.test.ts) — nimmt an, dass
// rows bereits nach datum absteigend sortiert reinkommen (so bestellt es
// getRouteCoverPhotos' Query), und behält pro route_id nur den ersten
// (= neuesten) Treffer.
export function firstPhotoPerRoute(rows: CoverPhotoRow[]): Map<string, string> {
  const covers = new Map<string, string>();
  for (const photo of rows) {
    if (!covers.has(photo.route_id)) covers.set(photo.route_id, photo.foto_url);
  }
  return covers;
}

// Ein einzelner IN(...)-Query statt eines Requests pro Strecke (N+1) — für
// die Explore-Liste, die potenziell hunderte Strecken gleichzeitig zeigt.
// Nur das jeweils neueste Foto pro Strecke als Coverbild; Strecken ohne
// Foto fehlen im Ergebnis (Aufrufer fallen dann auf die SVG-Routenform
// zurück, siehe ExploreSidebar.tsx).
export async function getRouteCoverPhotos(
  routeIds: string[],
): Promise<Map<string, string>> {
  if (routeIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("route_photos")
    .select("route_id, foto_url, datum")
    .in("route_id", routeIds)
    .order("datum", { ascending: false });

  return firstPhotoPerRoute((data as CoverPhotoRow[]) ?? []);
}
