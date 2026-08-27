import { createClient } from "@/lib/supabase/server";

export async function isFavorite(routeId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("route_id")
    .eq("route_id", routeId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}
