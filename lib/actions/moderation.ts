"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";

// Zusätzlich zur RLS-Policy "Moderatoren können alle Strecken freischalten"
// (siehe 0009_profil_erweiterungen.sql) auch hier explizit prüfen
// (Defense-in-Depth) — sonst wäre eine künftige, versehentlich zu weit
// gefasste Policy (wie der Fahrzeuge-Bug in 0015) hier ohne jede
// Anwendungs-Sicherung ausnutzbar.
//
// Ablehnung löscht die Zeile nicht mehr (0011_route_ablehnung.sql), sondern
// setzt abgelehnt_am, damit der Ersteller den Status im eigenen Profil sieht.

export async function approveRoute(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase.from("routes").update({ status_ok: true, abgelehnt_am: null }).eq("id", routeId);
  revalidatePath("/moderation");
  revalidatePath("/");
  revalidatePath("/profil");
}

export async function rejectRoute(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase
    .from("routes")
    .update({ status_ok: false, abgelehnt_am: new Date().toISOString() })
    .eq("id", routeId);
  revalidatePath("/moderation");
  revalidatePath("/");
  revalidatePath("/profil");
}
