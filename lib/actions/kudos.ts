"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { isValidUuid } from "@/lib/validation";

// Kurzer Cooldown gegen skriptgesteuertes Durchklicken vieler Fahrten —
// eine echte Nutzerin, die mehrere Kudos hintereinander vergibt, merkt eine
// halbe Sekunde Abstand zwischen Klicks nicht.
const KUDOS_COOLDOWN_MS = 500;

// Reines Toggle wie toggleFavorite (lib/actions/favorites.ts). RLS
// (0029_kudos.sql) erzwingt unabhängig davon, dass nur auf öffentliche
// Fahrten (ist_oeffentlich = true) Kudos gegeben werden können — ein
// insert auf eine private Fahrt schlägt serverseitig fehl, auch falls hier
// je ein Aufruf mit falscher completionId ankäme.
export async function toggleKudos(completionId: string): Promise<{ ok: boolean }> {
  if (!isValidUuid(completionId)) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  if (await isRateLimited(supabase, "kudos", "erstellt_am", "user_id", user.id, KUDOS_COOLDOWN_MS)) {
    return { ok: false };
  }

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

// Markiert die eigenen Kudos-Reaktionen als gesehen (setzt
// profiles.kudos_gesehen_am = now() über mark_kudos_seen,
// 0053_kudos_gesehen.sql) — aufgerufen beim Laden des eigenen Profils
// (components/MarkKudosSeen.tsx), setzt den Ungelesen-Zähler in der
// Navigation (lib/kudos.ts, getUnseenKudosCount) auf null zurück.
export async function markKudosSeen(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_kudos_seen");
}
