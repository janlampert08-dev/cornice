import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PublicFahrt } from "@/types/database";

// Rein privat: nur die eigene bisherige Bestzeit des Nutzers für diese
// Strecke, kein Vergleich mit anderen (RLS erlaubt ohnehin nur eigene Zeilen).
export async function getPersonalBestSeconds(
  routeId: string,
  userId: string,
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("route_completions")
    .select("dauer_sekunden")
    .eq("route_id", routeId)
    .eq("user_id", userId)
    .not("dauer_sekunden", "is", null)
    .order("dauer_sekunden", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.dauer_sekunden ?? null;
}

export interface CompletionDetail {
  id: string;
  routeId: string;
  userId: string;
  datum: string;
  dauerSekunden: number | null;
  distanzKm: number | null;
  istOeffentlich: boolean;
  // Nur gesetzt, wenn der Betrachter der Besitzer ist — rein private Felder
  // (siehe route_completions-Spaltenkommentare in supabase/migrations),
  // werden für fremde Betrachter nie geladen, nicht nur nicht angezeigt.
  abdeckungProzent: number | null;
  notiz: string | null;
  vehicle: { typ: string; marke: string; modell: string } | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
}

// Für die Fahrt-Detailseite (app/fahrten/[id]/page.tsx) — zwei Pfade, je
// nachdem wer die Fahrt gefahren ist:
// 1. Öffentliche Fahrt (auch fremde): über public_fahrten (0017/0018/0029/
//    0030/0032). Die View läuft mit den Rechten ihres Owners und umgeht
//    damit RLS auf route_completions (die sonst nur dem Besitzer selbst
//    SELECT erlaubt) — funktioniert dadurch auch für anonyme Betrachter.
// 2. Alles andere (private Fahrt, oder gar nicht öffentlich geteilt):
//    direkter Zugriff auf route_completions, RLS erlaubt das nur dem
//    Besitzer selbst — für jeden anderen liefert das keine Zeile, exakt
//    das gewünschte Verhalten (private Fahrten fremder Nutzer bleiben
//    unsichtbar).
export const getCompletionDetail = cache(async function getCompletionDetail(
  id: string,
  viewerId: string | null,
): Promise<CompletionDetail | null> {
  const supabase = await createClient();

  const { data: publicRow } = await supabase
    .from("public_fahrten")
    .select("*")
    .eq("completion_id", id)
    .maybeSingle();

  if (publicRow) {
    const row = publicRow as PublicFahrt;
    const isOwner = viewerId === row.user_id;

    // public_fahrten (0017/.../0032) deliberately omits abdeckung_prozent/
    // notiz/vehicle — they're not meant for other viewers. But when the
    // viewer IS the owner of this (public) completion, they should still
    // see their own private fields, same as on any of their other rides —
    // a second lookup against route_completions (RLS permits the owner to
    // read their own row) fills those back in instead of leaving them null.
    let abdeckungProzent: number | null = null;
    let notiz: string | null = null;
    let vehicle: CompletionDetail["vehicle"] = null;

    if (isOwner) {
      const { data: own } = await supabase
        .from("route_completions")
        .select("abdeckung_prozent, notiz, vehicles(typ, marke, modell)")
        .eq("id", id)
        .eq("user_id", viewerId)
        .maybeSingle<{
          abdeckung_prozent: number;
          notiz: string | null;
          vehicles: { typ: string; marke: string; modell: string } | null;
        }>();

      if (own) {
        abdeckungProzent = own.abdeckung_prozent;
        notiz = own.notiz;
        vehicle = own.vehicles;
      }
    }

    return {
      id: row.completion_id,
      routeId: row.route_id,
      userId: row.user_id,
      datum: row.datum,
      dauerSekunden: row.dauer_sekunden,
      distanzKm: row.distanz_km,
      istOeffentlich: true,
      abdeckungProzent,
      notiz,
      vehicle,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      isOwner,
    };
  }

  if (!viewerId) return null;

  const { data: own } = await supabase
    .from("route_completions")
    .select(
      "id, route_id, user_id, datum, dauer_sekunden, distanz_km, ist_oeffentlich, abdeckung_prozent, notiz, vehicles(typ, marke, modell)",
    )
    .eq("id", id)
    .eq("user_id", viewerId)
    .maybeSingle<{
      id: string;
      route_id: string;
      user_id: string;
      datum: string;
      dauer_sekunden: number | null;
      distanz_km: number | null;
      ist_oeffentlich: boolean;
      abdeckung_prozent: number;
      notiz: string | null;
      vehicles: { typ: string; marke: string; modell: string } | null;
    }>();

  if (!own) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", viewerId)
    .maybeSingle();

  return {
    id: own.id,
    routeId: own.route_id,
    userId: own.user_id,
    datum: own.datum,
    dauerSekunden: own.dauer_sekunden,
    distanzKm: own.distanz_km,
    istOeffentlich: own.ist_oeffentlich,
    abdeckungProzent: own.abdeckung_prozent,
    notiz: own.notiz,
    vehicle: own.vehicles,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isOwner: true,
  };
});
