"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Reines Toggle wie toggleFavorite (lib/actions/favorites.ts). RLS
// (0029_kudos.sql) erzwingt unabhängig davon, dass nur auf öffentliche
// Fahrten (ist_oeffentlich = true) Kudos gegeben werden können — ein
// insert auf eine private Fahrt schlägt serverseitig fehl, auch falls hier
// je ein Aufruf mit falscher completionId ankäme.
export async function toggleKudos(completionId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  const { data: existing } = await supabase
    .from("kudos")
    .select("completion_id")
    .eq("completion_id", completionId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("kudos").delete().eq("completion_id", completionId).eq("user_id", user.id)
    : await supabase.from("kudos").insert({ completion_id: completionId, user_id: user.id });

  if (error) return { ok: false };

  revalidatePath("/fahrer/[id]", "page");
  revalidatePath("/fahrten/[id]", "page");
  revalidatePath("/feed");
  revalidatePath("/profil");
  return { ok: true };
}
