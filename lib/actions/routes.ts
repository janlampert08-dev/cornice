"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import {
  buildHoehenprofil,
  computeHoeheUndSteigung,
  countKehren,
  fetchElevationProfile,
} from "@/lib/elevation";
import { formatCoordFallback, reverseGeocode } from "@/lib/geocoding";
import type { GeoLineString, Kategorie } from "@/types/database";

export interface ProposeRouteState {
  error: string | null;
}

export async function proposeRoute(
  _prevState: ProposeRouteState,
  formData: FormData,
): Promise<ProposeRouteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const name = String(formData.get("name") ?? "").trim();
  const laengeKm = Number(formData.get("laenge_km"));
  const charakterText = String(formData.get("charakter_text") ?? "").trim() || null;
  const kategorien = formData.getAll("kategorien") as Kategorie[];

  const geometryRaw = String(formData.get("geometry_geojson") ?? "");
  const tempolimitsRaw = String(formData.get("tempolimits") ?? "[]");
  const requestedPrivat = formData.get("ist_privat") === "true";

  if (!name) {
    return { error: "Bitte einen Namen für die Strecke angeben." };
  }
  if (!geometryRaw) {
    return { error: "Bitte mindestens zwei Wegpunkte auf der Karte setzen." };
  }
  if (!(laengeKm > 0)) {
    return { error: "Bitte eine gültige Länge in km angeben." };
  }

  let geometry: GeoLineString;
  let tempolimits: unknown;
  try {
    geometry = JSON.parse(geometryRaw);
    tempolimits = JSON.parse(tempolimitsRaw);
  } catch {
    return { error: "Route konnte nicht verarbeitet werden." };
  }

  // Start-/Zielort und Region kommen nicht mehr aus dem Formular, sondern
  // werden aus der gezeichneten Route abgeleitet (Reverse-Geocoding) — bei
  // einer Rundfahrt ist der letzte Punkt identisch mit dem ersten (siehe
  // NeueStreckeForm), ein zweiter Lookup wäre redundant. Schlägt das
  // Geocoding fehl, fällt es auf die Koordinate als Text zurück statt den
  // Vorschlag zu blockieren — ein Moderator kann den Wert bei der Freigabe
  // korrigieren (EditRouteForm/updateRouteAsModerator).
  const coords = geometry.coordinates;
  const startCoord = coords[0];
  const endCoord = coords[coords.length - 1];
  const isLoop = startCoord[0] === endCoord[0] && startCoord[1] === endCoord[1];

  const [startGeo, endGeo] = await Promise.all([
    reverseGeocode(startCoord),
    isLoop ? Promise.resolve(null) : reverseGeocode(endCoord),
  ]);

  const startOrt = startGeo?.ort ?? formatCoordFallback(startCoord);
  const zielOrt = isLoop ? startOrt : (endGeo?.ort ?? formatCoordFallback(endCoord));
  const region = startGeo?.region ?? startOrt;

  // Höhe/Steigung/Kehren automatisch aus der Geometrie ableiten (swisstopo-
  // Höhenprofil + Peilungsanalyse) — bei einem API-Ausfall lieber ohne diese
  // Werte veröffentlichen als den Vorschlag zu blockieren.
  let hoeheM: number | null = null;
  let maxSteigungProzent: number | null = null;
  let hoehenprofil: unknown = null;
  const kehren = countKehren(geometry.coordinates);
  const profile = await fetchElevationProfile(geometry.coordinates);
  if (profile) {
    const stats = computeHoeheUndSteigung(profile);
    hoeheM = stats.hoeheM;
    maxSteigungProzent = stats.maxSteigungProzent;
    hoehenprofil = buildHoehenprofil(profile);
  }

  // p_laenge_km is only a fast client-side plausibility check above
  // (laengeKm > 0) — propose_route_full (0033) recomputes and stores the
  // authoritative length itself from p_geometry_geojson via ST_Length,
  // so a mismatched or fabricated value here can't end up in the DB.
  const { data, error } = await supabase.rpc("propose_route_full", {
    p_name: name,
    p_region: region,
    p_start_ort: startOrt,
    p_ziel_ort: zielOrt,
    p_geometry_geojson: geometry,
    p_laenge_km: laengeKm,
    p_kategorien: kategorien,
    p_charakter_text: charakterText,
    p_tempolimits: tempolimits,
    p_hoehe_m: hoeheM,
    p_max_steigung_prozent: maxSteigungProzent,
    p_kehren: kehren,
    p_hoehenprofil: hoehenprofil,
  });

  if (error || !data) {
    return { error: "Strecke konnte nicht gespeichert werden." };
  }

  // Premium-Gating vorerst deaktiviert — private Strecken ohne
  // Moderationspflicht stehen allen Nutzern offen, siehe
  // components/PremiumCard.tsx.
  if (requestedPrivat) {
    await supabase.from("routes").update({ ist_privat: true }).eq("id", data);
  }

  redirect(`/strecken/${data}`);
}

// Nimmt eine private Strecke aus dem Premium-Feature "eigene Strecken" in die
// normale Moderationswarteschlange auf (ist_privat=false, status_ok bleibt
// false) — ab dann läuft sie wie jeder andere Vorschlag über approveRoute/
// rejectRoute. Verlässt sich auf die RLS-Policy "Nutzer können eigene
// unverifizierte Strecken bearbeiten" (0001_init.sql).
export async function publishPrivateRoute(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("routes")
    .update({ ist_privat: false })
    .eq("id", routeId)
    .eq("erstellt_von", user.id)
    .eq("status_ok", false);

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/profil");
  revalidatePath("/moderation");
}

// Verlässt sich auf die RLS-Policy "Nutzer können eigene abgelehnte
// Vorschläge löschen" (siehe 0012_eigene_abgelehnte_loeschen.sql) — ein
// Versuch auf eine fremde, bewilligte oder noch ausstehende Strecke betrifft
// schlicht 0 Zeilen betroffen statt einen Fehler zu werfen.
export async function deleteOwnRejectedRoute(routeId: string) {
  const supabase = await createClient();
  await supabase.from("routes").delete().eq("id", routeId);
  revalidatePath("/profil");
}

export interface UpdateRouteState {
  error: string | null;
}

// Bearbeitet nur die Metadaten eines eigenen, noch nicht bewilligten
// Vorschlags — der Streckenverlauf selbst (Geometrie/Länge/Tempolimits)
// bleibt unangetastet, da die ursprünglichen Wegpunkte nicht gespeichert
// werden und sich nicht verlustfrei aus der fertigen Route rekonstruieren
// lassen. Setzt abgelehnt_am zurück, damit ein überarbeiteter, zuvor
// abgelehnter Vorschlag wieder in der Moderationswarteschlange erscheint.
// Verlässt sich auf die RLS-Policy "Nutzer können eigene unverifizierte
// Strecken bearbeiten" (siehe 0001_init.sql).
export async function updateRoute(
  routeId: string,
  _prevState: UpdateRouteState,
  formData: FormData,
): Promise<UpdateRouteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const startOrt = String(formData.get("start_ort") ?? "").trim();
  const zielOrt = String(formData.get("ziel_ort") ?? "").trim();
  const charakterText = String(formData.get("charakter_text") ?? "").trim() || null;
  const kategorien = formData.getAll("kategorien") as Kategorie[];

  if (!name || !region || !startOrt || !zielOrt) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  const { error } = await supabase
    .from("routes")
    .update({
      name,
      region,
      start_ort: startOrt,
      ziel_ort: zielOrt,
      charakter_text: charakterText,
      kategorien,
      abgelehnt_am: null,
    })
    .eq("id", routeId)
    .eq("erstellt_von", user.id)
    .eq("status_ok", false);

  if (error) return { error: "Änderungen konnten nicht gespeichert werden." };

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/profil");
  redirect(`/strecken/${routeId}`);
}

// Wie updateRoute, aber für Moderatoren: darf jede Strecke bearbeiten
// (unabhängig von Ersteller/Status) und rührt abgelehnt_am nicht an —
// verlässt sich auf die RLS-Policy "Moderatoren können alle Strecken
// freischalten" (siehe 0009_profil_erweiterungen.sql), die trotz ihres
// Namens ein uneingeschränktes UPDATE für Moderatoren erlaubt.
export async function updateRouteAsModerator(
  routeId: string,
  _prevState: UpdateRouteState,
  formData: FormData,
): Promise<UpdateRouteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) {
    return { error: "Keine Berechtigung." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const startOrt = String(formData.get("start_ort") ?? "").trim();
  const zielOrt = String(formData.get("ziel_ort") ?? "").trim();
  const charakterText = String(formData.get("charakter_text") ?? "").trim() || null;
  const kategorien = formData.getAll("kategorien") as Kategorie[];

  if (!name || !region || !startOrt || !zielOrt) {
    return { error: "Bitte alle Pflichtfelder ausfüllen." };
  }

  const { error } = await supabase
    .from("routes")
    .update({
      name,
      region,
      start_ort: startOrt,
      ziel_ort: zielOrt,
      charakter_text: charakterText,
      kategorien,
    })
    .eq("id", routeId);

  if (error) return { error: "Änderungen konnten nicht gespeichert werden." };

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/");
  revalidatePath("/moderation");
  redirect(`/strecken/${routeId}`);
}

// Verlässt sich auf die RLS-Policy "Moderatoren können Strecken ablehnen
// (löschen)" (siehe 0009_profil_erweiterungen.sql), die trotz ihres Namens
// ein uneingeschränktes DELETE für Moderatoren erlaubt — unabhängig davon,
// ob die Strecke bereits bewilligt ist.
export async function deleteRouteAsModerator(routeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isModerator(user.id))) return;

  await supabase.from("routes").delete().eq("id", routeId);
  revalidatePath("/");
  revalidatePath("/moderation");
  redirect("/");
}
