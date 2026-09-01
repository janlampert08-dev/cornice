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
  // Für private Fahrten nur gesetzt, wenn der Betrachter der Besitzer ist.
  // Für öffentliche Fahrten (ab 0035_public_fahrten_notiz.sql) für jeden
  // Betrachter gesetzt — teilt sich dieselbe Sichtbarkeit wie die Fahrt
  // selbst, siehe public_fahrten-View-Kommentar.
  abdeckungProzent: number | null;
  notiz: string | null;
  vehicle: { typ: string; marke: string; modell: string } | null;
  displayName: string | null;
  avatarUrl: string | null;
  fotoUrl: string | null;
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
    return {
      id: row.completion_id,
      routeId: row.route_id,
      userId: row.user_id,
      datum: row.datum,
      dauerSekunden: row.dauer_sekunden,
      distanzKm: row.distanz_km,
      istOeffentlich: true,
      // Ab 0035_public_fahrten_notiz.sql: teilt sich die Sichtbarkeit der
      // Fahrt selbst — hier immer gesetzt (die View filtert bereits auf
      // ist_oeffentlich = true), nicht mehr nur für den Besitzer.
      abdeckungProzent: row.abdeckung_prozent,
      notiz: row.notiz,
      vehicle: row.fahrzeug_marke
        ? { typ: row.fahrzeug_typ!, marke: row.fahrzeug_marke, modell: row.fahrzeug_modell! }
        : null,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      fotoUrl: row.foto_url,
      isOwner: viewerId === row.user_id,
    };
  }

  if (!viewerId) return null;

  const { data: own } = await supabase
    .from("route_completions")
    .select(
      "id, route_id, user_id, datum, dauer_sekunden, distanz_km, ist_oeffentlich, abdeckung_prozent, notiz, foto_url, vehicles(typ, marke, modell)",
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
      foto_url: string | null;
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
    fotoUrl: own.foto_url,
    isOwner: true,
  };
});
