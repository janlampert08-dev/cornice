"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";

export interface RatingFormState {
  error: string | null;
}

const RATING_COOLDOWN_MS = 3000;

export async function submitRating(
  routeId: string,
  _prevState: RatingFormState,
  formData: FormData,
): Promise<RatingFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const sterne = Number(formData.get("sterne"));
  const kommentar = String(formData.get("kommentar") ?? "").trim() || null;

  if (!Number.isInteger(sterne) || sterne < 1 || sterne > 5) {
    return { error: "Bitte wähle 1–5 Sterne." };
  }

  if (await isRateLimited(supabase, "route_ratings", "erstellt_am", "user_id", user.id, RATING_COOLDOWN_MS)) {
    return { error: "Bitte warte einen Moment, bevor du erneut bewertest." };
  }

  const { error } = await supabase
    .from("route_ratings")
    .upsert(
      { route_id: routeId, user_id: user.id, sterne, kommentar },
      { onConflict: "route_id,user_id" },
    );

  if (error) {
    // Race-freie Durchsetzung via DB-Trigger (0024) — der App-seitige Check
    // oben ist nur ein schnelles Vorab-Feedback und kann bei parallelen
    // Requests theoretisch durchrutschen.
    if (error.message.includes("cooldown_active")) {
      return { error: "Bitte warte einen Moment, bevor du erneut bewertest." };
    }
    return { error: "Bewertung konnte nicht gespeichert werden." };
  }

  revalidatePath(`/strecken/${routeId}`);
  return { error: null };
}
