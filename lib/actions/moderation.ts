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
    .update({ abgelehnt_am: new Date().toISOString() })
    .eq("id", routeId);
  revalidatePath("/moderation");
  revalidatePath("/profil");
}

// Meldungen (route_reports/rating_reports, siehe 0043_content_reports.sql)
// — Nutzer melden Strecken/Kommentare über lib/actions/reports.ts, hier
// folgen nur die moderator-seitigen Aktionen darauf.

export async function dismissRouteReport(reportId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase
    .from("route_reports")
    .update({ status: "erledigt", bearbeitet_am: new Date().toISOString(), bearbeitet_von: user.id })
    .eq("id", reportId);
  revalidatePath("/moderation");
}

export async function dismissRatingReport(reportId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase
    .from("rating_reports")
    .update({ status: "erledigt", bearbeitet_am: new Date().toISOString(), bearbeitet_von: user.id })
    .eq("id", reportId);
  revalidatePath("/moderation");
}

// Löscht die gemeldete Strecke direkt aus der Moderationswarteschlange
// heraus. Bewusst eine eigene, schlanke Funktion statt deleteRouteAsModerator
// (lib/actions/routes.ts) wiederzuverwenden — jene ist für den
// Streckendetail-Kontext gedacht und redirected nach "/", hier soll die
// Moderationsseite bestehen bleiben. Offene Meldungen zu dieser Strecke
// verschwinden automatisch per FK-Cascade (route_reports.route_id →
// routes.id on delete cascade, 0043).
export async function deleteReportedRoute(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase.from("routes").delete().eq("id", routeId);
  revalidatePath("/moderation");
  revalidatePath("/");
}

// Wie deleteReportedRoute, aber für eine gemeldete Bewertung/einen
// gemeldeten Kommentar — verlässt sich auf die neue RLS-Policy "Moderatoren
// können Bewertungen löschen" (0043). Cascade (rating_reports.rating_id →
// route_ratings.id on delete cascade) räumt zugehörige offene Meldungen
// automatisch mit auf.
export async function deleteReportedRating(ratingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  const { data: rating } = await supabase
    .from("route_ratings")
    .select("route_id")
    .eq("id", ratingId)
    .maybeSingle();

  await supabase.from("route_ratings").delete().eq("id", ratingId);
  revalidatePath("/moderation");
  if (rating) revalidatePath(`/strecken/${rating.route_id}`);
}
