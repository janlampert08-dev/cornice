"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { isValidUuid } from "@/lib/validation";

export interface RatingFormState {
  error: string | null;
}

const RATING_COOLDOWN_MS = 3000;
const MAX_KOMMENTAR_LENGTH = 1000;

export async function submitRating(
  routeId: string,
  _prevState: RatingFormState,
  formData: FormData,
): Promise<RatingFormState> {
  if (!isValidUuid(routeId)) return { error: "Strecke nicht gefunden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const kommentar = String(formData.get("kommentar") ?? "").trim() || null;

  if (!kommentar) {
    return { error: "Bitte gib einen Kommentar ein." };
  }
  if (kommentar.length > MAX_KOMMENTAR_LENGTH) {
    return { error: `Kommentar darf höchstens ${MAX_KOMMENTAR_LENGTH} Zeichen lang sein.` };
  }

  if (await isRateLimited(supabase, "route_ratings", "erstellt_am", "user_id", user.id, RATING_COOLDOWN_MS)) {
    return { error: "Bitte warte einen Moment, bevor du erneut kommentierst." };
  }

  const { error } = await supabase
    .from("route_ratings")
    .upsert(
      { route_id: routeId, user_id: user.id, kommentar },
      { onConflict: "route_id,user_id" },
    );

  if (error) {
    // Race-freie Durchsetzung via DB-Trigger (0024, erweitert in 0041 auf
    // Updates) — der App-seitige Check oben ist nur ein schnelles
    // Vorab-Feedback und kann bei parallelen Requests oder beim Bearbeiten
    // eines bestehenden Kommentars (upsert → UPDATE statt INSERT)
    // theoretisch durchrutschen.
    if (error.message.includes("cooldown_active")) {
      return { error: "Bitte warte einen Moment, bevor du erneut kommentierst." };
    }
    return { error: "Kommentar konnte nicht gespeichert werden." };
  }

  revalidatePath(`/strecken/${routeId}`);
  return { error: null };
}
