"use server";

import { createClient } from "@/lib/supabase/server";

export interface ReportState {
  error: string | null;
  success?: boolean;
}

// Feste Werte statt Freitext, damit die Moderationswarteschlange (siehe
// lib/moderation.ts) filter-/auswertbar bleibt — ein optionaler
// Freitextkommentar ergänzt bei Bedarf.
export const REPORT_REASONS = [
  { value: "unangemessen", label: "Unangemessener Inhalt" },
  { value: "spam", label: "Spam" },
  { value: "falsche_angaben", label: "Falsche Angaben" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["value"];

function isValidReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

export async function reportRoute(
  routeId: string,
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const grund = String(formData.get("grund") ?? "");
  if (!isValidReason(grund)) {
    return { error: "Bitte einen Grund auswählen." };
  }
  const kommentar = String(formData.get("kommentar") ?? "").trim() || null;

  const { error } = await supabase
    .from("route_reports")
    .insert({ route_id: routeId, reporter_id: user.id, grund, kommentar });

  if (error) {
    // unique_violation (route_id, reporter_id) — siehe 0043.
    if (error.code === "23505") {
      return { error: "Du hast diese Strecke bereits gemeldet." };
    }
    return { error: "Meldung konnte nicht gesendet werden." };
  }

  return { error: null, success: true };
}

export async function reportRating(
  ratingId: string,
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const grund = String(formData.get("grund") ?? "");
  if (!isValidReason(grund)) {
    return { error: "Bitte einen Grund auswählen." };
  }
  const kommentar = String(formData.get("kommentar") ?? "").trim() || null;

  const { error } = await supabase
    .from("rating_reports")
    .insert({ rating_id: ratingId, reporter_id: user.id, grund, kommentar });

  if (error) {
    if (error.code === "23505") {
      return { error: "Du hast diesen Kommentar bereits gemeldet." };
    }
    return { error: "Meldung konnte nicht gesendet werden." };
  }

  return { error: null, success: true };
}
