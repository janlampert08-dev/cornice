import { createClient } from "@/lib/supabase/server";

// Rein privat: nur die eigene bisherige Bestzeit des Nutzers für diese
// Strecke, kein Vergleich mit anderen (RLS erlaubt ohnehin nur eigene Zeilen).
export async function getPersonalBestSeconds(
  routeId: string,
  userId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_completions")
    .select("dauer_sekunden")
    .eq("route_id", routeId)
    .eq("user_id", userId)
    .not("dauer_sekunden", "is", null)
    .order("dauer_sekunden", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.dauer_sekunden ?? null;
}
