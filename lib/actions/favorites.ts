"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { isValidUuid } from "@/lib/validation";

const FAVORITE_COOLDOWN_MS = 500;

export async function toggleFavorite(routeId: string): Promise<{ ok: boolean }> {
  if (!isValidUuid(routeId)) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  if (await isRateLimited(supabase, "favorites", "erstellt_am", "user_id", user.id, FAVORITE_COOLDOWN_MS)) {
    return { ok: false };
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("route_id")
    .eq("route_id", routeId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("favorites").delete().eq("route_id", routeId).eq("user_id", user.id)
    : await supabase.from("favorites").insert({ route_id: routeId, user_id: user.id });

  if (error) return { ok: false };

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/profil");
  return { ok: true };
}
