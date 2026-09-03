"use server";

import { createClient } from "@/lib/supabase/server";
import { REPORT_REASONS } from "@/lib/constants";
import { isRateLimited } from "@/lib/rateLimit";
import { isValidUuid } from "@/lib/validation";

export interface ReportState {
  error: string | null;
  success?: boolean;
}

type ReportReason = (typeof REPORT_REASONS)[number]["value"];

function isValidReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

// Freitext für die Moderation, kein öffentlicher Diskussionsbeitrag — 500
// Zeichen reichen für eine kurze Begründung.
const MAX_KOMMENTAR_LENGTH = 500;
const REPORT_COOLDOWN_MS = 3000;

function readKommentar(formData: FormData): string | null {
  const raw = String(formData.get("kommentar") ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, MAX_KOMMENTAR_LENGTH);
}

export async function reportRoute(
  routeId: string,
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  if (!isValidUuid(routeId)) return { error: "Strecke nicht gefunden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const grund = String(formData.get("grund") ?? "");
  if (!isValidReason(grund)) {
    return { error: "Bitte einen Grund auswählen." };
  }
  const kommentar = readKommentar(formData);

  if (
    await isRateLimited(supabase, "route_reports", "erstellt_am", "reporter_id", user.id, REPORT_COOLDOWN_MS)
  ) {
    return { error: "Bitte warte einen Moment, bevor du erneut etwas meldest." };
  }

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
  if (!isValidUuid(ratingId)) return { error: "Kommentar nicht gefunden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const grund = String(formData.get("grund") ?? "");
  if (!isValidReason(grund)) {
    return { error: "Bitte einen Grund auswählen." };
  }
  const kommentar = readKommentar(formData);

  if (
    await isRateLimited(supabase, "rating_reports", "erstellt_am", "reporter_id", user.id, REPORT_COOLDOWN_MS)
  ) {
    return { error: "Bitte warte einen Moment, bevor du erneut etwas meldest." };
  }

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

// Melden einer geteilten Fahrt (0046_fahrt_meldungen.sql). Anders als bei
// Strecke und Kommentar geht es hier um Titel, Notiz, Fotos und Track einer
// persönlichen Aufzeichnung — die Moderation nimmt eine gemeldete Fahrt aus
// der Öffentlichkeit, statt sie zu löschen.
export async function reportCompletion(
  completionId: string,
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  if (!isValidUuid(completionId)) return { error: "Fahrt nicht gefunden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const grund = String(formData.get("grund") ?? "");
  if (!isValidReason(grund)) {
    return { error: "Bitte einen Grund auswählen." };
  }
  const kommentar = readKommentar(formData);

  if (
    await isRateLimited(
      supabase,
      "completion_reports",
      "erstellt_am",
      "reporter_id",
      user.id,
      REPORT_COOLDOWN_MS,
    )
  ) {
    return { error: "Bitte warte einen Moment, bevor du erneut etwas meldest." };
  }

  const { error } = await supabase
    .from("completion_reports")
    .insert({ completion_id: completionId, reporter_id: user.id, grund, kommentar });

  if (error) {
    if (error.code === "23505") {
      return { error: "Du hast diese Fahrt bereits gemeldet." };
    }
    return { error: "Meldung konnte nicht gesendet werden." };
  }

  return { error: null, success: true };
}
