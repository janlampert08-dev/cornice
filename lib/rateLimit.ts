import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Einfacher Cooldown ohne externe Infrastruktur (kein Redis nötig): blockt
// wiederholte Einträge desselben Nutzers innerhalb eines kurzen Zeitfensters,
// um Spam/Skript-Missbrauch zu bremsen. Echte Nutzung (mehrere Fahrten an
// unterschiedlichen Tagen, gelegentliche Neubewertungen) bleibt unberührt,
// da das Fenster nur wenige Sekunden umfasst.
export async function isRateLimited(
  supabase: SupabaseClient,
  table: string,
  timestampColumn: string,
  userColumn: string,
  userId: string,
  cooldownMs: number,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select(timestampColumn)
    .eq(userColumn, userId)
    .order(timestampColumn, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  const lastTimestamp = (data as unknown as Record<string, string>)[timestampColumn];
  if (!lastTimestamp) return false;
  return Date.now() - new Date(lastTimestamp).getTime() < cooldownMs;
}
