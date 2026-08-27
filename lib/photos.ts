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
