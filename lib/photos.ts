import { createClient } from "@/lib/supabase/server";
import type { RoutePhoto } from "@/types/database";

// Fotos für die Fotos-Sektion einer Streckenseite (app/strecken/[id]/page.tsx,
// PhotoGallery) — bewusst die einzige Stelle, an der hochgeladene Fahrt-
// Fotos angezeigt werden (nicht als Vorschaubild in der Explore-Liste oder
// im Feed, siehe Entfernung von getRouteCoverPhotos).
export async function getRoutePhotos(routeId: string): Promise<RoutePhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_photos")
    .select("*")
    .eq("route_id", routeId)
    .order("datum", { ascending: false });

  return (data as RoutePhoto[]) ?? [];
}
