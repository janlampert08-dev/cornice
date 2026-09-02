"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { computeRouteCoverage, COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";
import { computeTrailStats, type TrailPoint } from "@/lib/geo";
import {
  MAX_JUMP_KM,
  MAX_RIDE_SECONDS,
  MAX_TRAIL_POINTS,
  maxJumpKm,
  movingSeconds,
  simplifyTrack,
  toEwktLineString,
} from "@/lib/track";
import { buildHoehenprofil, computeAscentM, fetchElevationProfile } from "@/lib/elevation";
import { reverseGeocode } from "@/lib/geocoding";
import { getRoute } from "@/lib/routes";
import { todayInZurich } from "@/lib/format";

export interface CompletionFormState {
  error: string | null;
}

const ROUTE_PHOTOS_BUCKET = "route-photos";
const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const COMPLETION_COOLDOWN_MS = 5000;
const MAX_NOTIZ_LENGTH = 280;
// Gleiche Grenze wie der CHECK auf route_completions.titel (0044).
const MAX_TITEL_LENGTH = 80;
const MIN_TRAIL_POINTS = 5;
// Grosszügig genug für eine echte Fahrt (mehrere Stopps unterwegs), aber
// begrenzt genug um Storage-Missbrauch über ein einzelnes Formular zu
// verhindern — siehe MAX_FOTO_BYTES für dieselbe Überlegung pro Datei.
const MAX_PHOTOS_PER_COMPLETION = 6;
// Grosszügige Obergrenze für die aus Distanz/Dauer abgeleitete
// Durchschnittsgeschwindigkeit — auch auf einer freigegebenen Passstrasse
// unrealistisch, deckt aber jede legitime Fahrt ab. Fängt grob gefälschte
// Trails (z.B. wenige, weit auseinanderliegende Punkte) ab, ohne echte
// GPS-Ungenauigkeit zu bestrafen.
const MAX_PLAUSIBLE_KMH = 200;

// Rohdaten des Clients: der aufgezeichnete GPS-Trail. Alle Kennzahlen einer
// Fahrt werden ausschliesslich hieraus abgeleitet — vom Client mitgeschickte
// Distanzen/Zeiten/Deckungsgrade wären beliebig fälschbar.
function parseTrail(formData: FormData): { trail: TrailPoint[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("trail") ?? "[]"));
  } catch {
    return { error: "Ungültige Tracking-Daten." };
  }

  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (p) =>
        p && typeof p.lng === "number" && typeof p.lat === "number" && typeof p.t === "number",
    )
  ) {
    return { error: "Ungültige Tracking-Daten." };
  }

  // Zu wenige Punkte heisst in aller Regel: die Aufzeichnung wurde nach
  // wenigen Sekunden beendet. Das ist kein Fehler des Nutzers und verdient
  // eine Erklärung statt "ungültige Daten".
  if (parsed.length < MIN_TRAIL_POINTS) {
    return { error: "Die Aufzeichnung ist zu kurz, um gespeichert zu werden." };
  }
  if (parsed.length > MAX_TRAIL_POINTS) {
    return { error: "Die Aufzeichnung enthält zu viele Punkte." };
  }

  return { trail: parsed as TrailPoint[] };
}

// Plausibilitätsprüfungen, die für jede Aufzeichnung gelten — unabhängig
// davon, ob sie zu einer Strecke gehört. Bei Streckenfahrten kommt der
// Deckungsgrad als zusätzlicher Anker dazu (computeRouteCoverage); eine
// freie Fahrt hat keinen solchen Anker, für sie sind diese Regeln die
// einzige Prüfung.
function implausibilityReason(
  trail: TrailPoint[],
  distanzKm: number,
  dauerSekunden: number,
): string | null {
  if (!(distanzKm > 0) || dauerSekunden <= 0) return "Ungültige Tracking-Daten.";
  if (distanzKm / (dauerSekunden / 3600) > MAX_PLAUSIBLE_KMH) {
    return "Unrealistische Durchschnittsgeschwindigkeit erkannt.";
  }
  if (dauerSekunden > MAX_RIDE_SECONDS) {
    return "Diese Aufzeichnung ist unrealistisch lang — wurde sie vielleicht nicht beendet?";
  }
  if (maxJumpKm(trail) > MAX_JUMP_KM) {
    return "Die Aufzeichnung enthält eine zu grosse Lücke zwischen zwei Punkten.";
  }
  return null;
}

async function uploadFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  foto: File,
): Promise<{ url: string } | { error: string }> {
  if (!foto.type.startsWith("image/")) {
    return { error: "Nur Bilddateien sind erlaubt." };
  }
  if (foto.size > MAX_FOTO_BYTES) {
    return { error: "Foto ist zu gross (max. 8 MB)." };
  }

  const ext = foto.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(ROUTE_PHOTOS_BUCKET).upload(path, foto);
  if (error) return { error: "Foto konnte nicht hochgeladen werden." };
  const { data } = supabase.storage.from(ROUTE_PHOTOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

// Best-effort-Aufräumen bereits hochgeladener Storage-Objekte, wenn ein
// späterer Schritt (weiterer Upload, die Fahrt selbst, oder die
// completion_photos-Zeilen) fehlschlägt — sonst blieben die Dateien ohne
// referenzierende Zeile verwaist im Bucket liegen.
async function removeUploadedFotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  urls: string[],
): Promise<void> {
  const bucketMarker = `/${ROUTE_PHOTOS_BUCKET}/`;
  const paths = urls
    .map((url) => {
      const markerIndex = url.indexOf(bucketMarker);
      return markerIndex === -1 ? null : url.slice(markerIndex + bucketMarker.length);
    })
    .filter((path): path is string => path !== null);
  if (paths.length > 0) {
    await supabase.storage.from(ROUTE_PHOTOS_BUCKET).remove(paths);
  }
}

// Lädt alle Fotos eines Formulars hoch, bevor die Fahrt selbst gespeichert
// wird: schlägt eine Datei fehl (Format/Grösse), soll gar keine halbe Fahrt
// ohne ihre Fotos entstehen. Bereits hochgeladene Dateien dieses Versuchs
// werden dabei wieder entfernt statt verwaist im Bucket liegen zu bleiben.
async function uploadFotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fotos: File[],
): Promise<{ urls: string[] } | { error: string }> {
  const urls: string[] = [];
  for (const foto of fotos) {
    const result = await uploadFoto(supabase, userId, foto);
    if ("error" in result) {
      await removeUploadedFotos(supabase, urls);
      return { error: result.error };
    }
    urls.push(result.url);
  }
  return { urls };
}

// Verknüpft hochgeladene Fotos mit der bereits gespeicherten Fahrt. Ein
// Fehler hier führt bewusst NICHT zu einem Fehler-Return beim Aufrufer (das
// würde den Nutzer zu einem erneuten Absenden verleiten und eine doppelte
// Fahrt anlegen). Best effort: die hochgeladenen Dateien ohne
// referenzierende Zeile wieder entfernen.
async function attachPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  completionId: string,
  userId: string,
  urls: string[],
): Promise<void> {
  if (urls.length === 0) return;
  const { error } = await supabase.from("completion_photos").insert(
    urls.map((foto_url, position) => ({
      completion_id: completionId,
      user_id: userId,
      foto_url,
      position,
    })),
  );
  if (error) await removeUploadedFotos(supabase, urls);
}

// Speichert eine per Live-GPS-Tracking erfasste Fahrt — der einzige Weg,
// eine Strecke als "gefahren" einzutragen (kein manueller Eintrag ohne GPS
// mehr, siehe Entfernung von logCompletion/CompletionForm). dauer_sekunden
// ist dadurch immer gesetzt, bleibt aber standardmässig privat (RLS erlaubt
// ohnehin nur den Zugriff auf eigene Einträge) — ob die Fahrt auf
// Bestenlisten/öffentlichem Profil erscheint, entscheidet der Nutzer pro
// Fahrt im Fazit-Screen (ist_oeffentlich, siehe 0017_pro_fahrt_sichtbarkeit.sql).
export async function logTrackedCompletion(
  routeId: string,
  _prevState: CompletionFormState,
  formData: FormData,
): Promise<CompletionFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  if (
    await isRateLimited(
      supabase,
      "route_completions",
      "created_at",
      "user_id",
      user.id,
      COMPLETION_COOLDOWN_MS,
    )
  ) {
    return { error: "Bitte warte einen Moment, bevor du erneut einträgst." };
  }

  const fahrzeugId = String(formData.get("fahrzeug_id") ?? "") || null;
  const requestedOeffentlich = formData.get("ist_oeffentlich") === "true";
  const notizRaw = String(formData.get("notiz") ?? "").trim();
  const notiz = notizRaw ? notizRaw.slice(0, MAX_NOTIZ_LENGTH) : null;
  const fotos = formData
    .getAll("foto")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS_PER_COMPLETION);

  // distanz_km/dauer_sekunden/abdeckung_prozent kommen NICHT vom Client —
  // die liessen sich beliebig fälschen (z.B. abdeckung_prozent=100,
  // dauer_sekunden=1 ohne je gefahren zu sein). Stattdessen wird alles aus
  // dem rohen GPS-Trail neu berechnet, denselben Algorithmen wie im Client
  // (für sofortiges UI-Feedback im Fazit-Screen), aber hier als einzige
  // massgebliche Quelle für Bestenlisten/Statistiken.
  const parsedTrail = parseTrail(formData);
  if ("error" in parsedTrail) return { error: parsedTrail.error };
  const trail = parsedTrail.trail;

  const route = await getRoute(routeId);
  if (!route) return { error: "Strecke nicht gefunden." };

  const { distanceKm: distanzKm, durationSeconds: dauerSekunden } = computeTrailStats(trail);
  const abdeckungProzent = computeRouteCoverage(
    route.geometry_geojson.coordinates as [number, number][],
    trail.map((p) => [p.lng, p.lat] as [number, number]),
  );

  const implausible = implausibilityReason(trail, distanzKm, dauerSekunden);
  if (implausible) return { error: implausible };

  // Serverseitig erzwungen, nicht nur im UI verhindert: unabhängig davon, was
  // das Formular schickt, kann eine Fahrt unterhalb des Deckungsgrad-
  // Schwellenwerts nicht öffentlich sein (siehe lib/routeCoverage.ts).
  const istOeffentlich = requestedOeffentlich && abdeckungProzent >= COVERAGE_THRESHOLD_PERCENT;

  const uploaded = await uploadFotos(supabase, user.id, fotos);
  if ("error" in uploaded) return { error: uploaded.error };
  const uploadedUrls = uploaded.urls;

  const { data: inserted, error } = await supabase
    .from("route_completions")
    .insert({
      route_id: routeId,
      user_id: user.id,
      fahrzeug_id: fahrzeugId,
      // Lokales Kalenderdatum (Europe/Zurich), nicht UTC — sonst würde eine
      // Fahrt kurz nach Mitternacht Ortszeit fälschlich auf den Vortag
      // gestempelt (siehe todayInZurich in lib/format.ts).
      datum: todayInZurich(),
      distanz_km: distanzKm,
      dauer_sekunden: dauerSekunden,
      // Reine Bewegtzeit ohne Pausen — für eine Passfahrt am Stück fast
      // identisch mit dauer_sekunden, aber dieselbe Berechnung für beide
      // Fahrtarten (siehe 0044_freie_fahrten.sql).
      bewegte_zeit_sekunden: movingSeconds(trail),
      art: "strecke",
      ist_oeffentlich: istOeffentlich,
      abdeckung_prozent: abdeckungProzent,
      notiz,
      // Ab 0044 wird der gefahrene Track gespeichert statt nach der
      // Berechnung verworfen — vereinfacht (die Kennzahlen oben stammen
      // weiterhin aus den Rohpunkten). Nur für den Besitzer lesbar.
      track: toEwktLineString(simplifyTrack(trail)),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    await removeUploadedFotos(supabase, uploadedUrls);
    // Race-freie Durchsetzung via DB-Trigger (0024) — der App-seitige Check
    // oben ist nur ein schnelles Vorab-Feedback und kann bei parallelen
    // Requests theoretisch durchrutschen.
    if (error?.message.includes("cooldown_active")) {
      return { error: "Bitte warte einen Moment, bevor du erneut einträgst." };
    }
    return { error: "Fahrt konnte nicht gespeichert werden." };
  }

  await attachPhotos(supabase, inserted.id, user.id, uploadedUrls);

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/profil");
  revalidatePath("/leaderboards");
  return { error: null };
}

export interface FreeRideFormState {
  error: string | null;
  // Bei Erfolg die ID der neu angelegten Fahrt, damit der Client direkt auf
  // ihre Detailseite wechseln kann (anders als bei einer Streckenfahrt gibt
  // es keine Streckenseite, zu der man zurückkehren könnte).
  completionId?: string;
}

// Höhenprofil und Anstieg einer freien Fahrt, best effort: der swisstopo-
// Dienst kennt nur Schweizer Koordinaten und kann ausfallen. Beides ist
// Beiwerk — eine Fahrt darf daran nicht scheitern, deshalb ausdrücklich
// abgefangen statt den Speichervorgang mitzureissen.
async function deriveElevation(
  coordinates: [number, number][],
): Promise<{ hoehenmeter_aufstieg: number | null; hoehenprofil: { km: number; m: number }[] | null }> {
  try {
    const profile = await fetchElevationProfile(coordinates);
    if (!profile || profile.length < 2) {
      return { hoehenmeter_aufstieg: null, hoehenprofil: null };
    }
    return {
      hoehenmeter_aufstieg: computeAscentM(profile),
      hoehenprofil: buildHoehenprofil(profile),
    };
  } catch {
    return { hoehenmeter_aufstieg: null, hoehenprofil: null };
  }
}

// Speichert eine freie Fahrt: dieselbe Aufzeichnung wie bei einer Strecke,
// nur ohne Streckenbezug (siehe 0044_freie_fahrten.sql). Es gibt damit auch
// keinen Deckungsgrad als Echtheitsanker — an seine Stelle treten die
// Plausibilitätsregeln in implausibilityReason().
//
// Freie Fahrten sind in dieser Phase immer privat: ist_oeffentlich wird hier
// bewusst nicht aus dem Formular übernommen, sondern fest auf false gesetzt.
// Das öffentliche Teilen (Feed, Profil) kommt zusammen mit der Kappung der
// Track-Enden und dem Meldeweg für Fahrten — vorher darf kein GPS-Track
// einer freien Fahrt nach aussen gelangen.
export async function logFreeRide(
  _prevState: FreeRideFormState,
  formData: FormData,
): Promise<FreeRideFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  if (
    await isRateLimited(
      supabase,
      "route_completions",
      "created_at",
      "user_id",
      user.id,
      COMPLETION_COOLDOWN_MS,
    )
  ) {
    return { error: "Bitte warte einen Moment, bevor du erneut einträgst." };
  }

  const parsedTrail = parseTrail(formData);
  if ("error" in parsedTrail) return { error: parsedTrail.error };
  const trail = parsedTrail.trail;

  const { distanceKm: distanzKm, durationSeconds: dauerSekunden } = computeTrailStats(trail);
  const implausible = implausibilityReason(trail, distanzKm, dauerSekunden);
  if (implausible) return { error: implausible };

  const fahrzeugId = String(formData.get("fahrzeug_id") ?? "") || null;
  const titelRaw = String(formData.get("titel") ?? "").trim();
  const titel = titelRaw ? titelRaw.slice(0, MAX_TITEL_LENGTH) : null;
  const notizRaw = String(formData.get("notiz") ?? "").trim();
  const notiz = notizRaw ? notizRaw.slice(0, MAX_NOTIZ_LENGTH) : null;
  const fotos = formData
    .getAll("foto")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS_PER_COMPLETION);

  const simplified = simplifyTrack(trail);
  const track = toEwktLineString(simplified);
  if (!track) return { error: "Ungültige Tracking-Daten." };
  const coordinates = simplified.map((p) => [p.lng, p.lat] as [number, number]);

  // Ortsbezug und Höhendaten parallel — beide sind externe Aufrufe, die die
  // Antwortzeit sonst nacheinander verlängern würden.
  const [ort, elevation] = await Promise.all([
    reverseGeocode(coordinates[0]).catch(() => null),
    deriveElevation(coordinates),
  ]);

  const uploaded = await uploadFotos(supabase, user.id, fotos);
  if ("error" in uploaded) return { error: uploaded.error };

  const { data: inserted, error } = await supabase
    .from("route_completions")
    .insert({
      user_id: user.id,
      art: "frei",
      route_id: null,
      abdeckung_prozent: null,
      fahrzeug_id: fahrzeugId,
      datum: todayInZurich(),
      distanz_km: distanzKm,
      dauer_sekunden: dauerSekunden,
      bewegte_zeit_sekunden: movingSeconds(trail),
      ist_oeffentlich: false,
      titel,
      notiz,
      start_ort: ort?.ort ?? null,
      region: ort?.region ?? null,
      hoehenmeter_aufstieg: elevation.hoehenmeter_aufstieg,
      hoehenprofil: elevation.hoehenprofil,
      track,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    await removeUploadedFotos(supabase, uploaded.urls);
    // Race-freie Durchsetzung via DB-Trigger (0024) — der App-seitige Check
    // oben ist nur ein schnelles Vorab-Feedback.
    if (error?.message.includes("cooldown_active")) {
      return { error: "Bitte warte einen Moment, bevor du erneut einträgst." };
    }
    return { error: "Fahrt konnte nicht gespeichert werden." };
  }

  await attachPhotos(supabase, inserted.id, user.id, uploaded.urls);

  revalidatePath("/profil");
  return { error: null, completionId: inserted.id };
}

export interface DeleteCompletionState {
  error: string | null;
}

// Fahrt endgültig löschen. Bis hierhin liess sich eine Fahrt nur auf privat
// stellen — bei einer freien Fahrt ist das zu wenig: wer versehentlich den
// Arbeitsweg aufgezeichnet hat, will die Aufzeichnung (und damit den
// gespeicherten GPS-Track) los sein, nicht nur unsichtbar.
//
// Die Fotozeilen (completion_photos) und Kudos verschwinden per FK-Cascade;
// die Storage-Objekte selbst müssen ausdrücklich entfernt werden, sonst
// bleiben sie verwaist im Bucket zurück.
export async function deleteCompletion(completionId: string): Promise<DeleteCompletionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { data: existing } = await supabase
    .from("route_completions")
    .select("id, route_id")
    .eq("id", completionId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; route_id: string | null }>();

  if (!existing) return { error: "Fahrt nicht gefunden." };

  const { data: photos } = await supabase
    .from("completion_photos")
    .select("foto_url")
    .eq("completion_id", completionId)
    .eq("user_id", user.id)
    .returns<{ foto_url: string }[]>();

  const { error } = await supabase
    .from("route_completions")
    .delete()
    .eq("id", completionId)
    .eq("user_id", user.id);

  if (error) return { error: "Fahrt konnte nicht gelöscht werden." };

  // Erst nach dem erfolgreichen Löschen der Zeile: schlägt das Entfernen der
  // Dateien fehl, bleiben sie zwar verwaist zurück, aber es steht keine
  // Fahrt mehr da, deren Fotos plötzlich fehlen.
  await removeUploadedFotos(supabase, (photos ?? []).map((p) => p.foto_url));

  revalidatePath("/profil");
  revalidatePath(`/fahrer/${user.id}`);
  revalidatePath("/feed");
  if (existing.route_id) revalidatePath(`/strecken/${existing.route_id}`);
  revalidatePath("/leaderboards");
  return { error: null };
}

export interface ToggleVisibilityState {
  error: string | null;
}

// Symbol-Umschalter unter "Getrackte Fahrten" im Profil — ändert die
// Sichtbarkeit einer bereits gespeicherten Fahrt nachträglich, ohne den
// Umweg über den Fazit-Screen (RLS erlaubt Update ohnehin nur der eigenen Zeile).
export async function toggleCompletionVisibility(
  completionId: string,
): Promise<ToggleVisibilityState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { data: existing } = await supabase
    .from("route_completions")
    .select("route_id, art, ist_oeffentlich, abdeckung_prozent")
    .eq("id", completionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Fahrt nicht gefunden." };

  const nextOeffentlich = !existing.ist_oeffentlich;
  // Solange freie Fahrten nicht geteilt werden können (siehe logFreeRide),
  // gilt das auch nachträglich — sonst liesse sich die Sperre über diesen
  // Umschalter umgehen.
  if (nextOeffentlich && existing.art === "frei") {
    return { error: "Freie Fahrten können derzeit nicht öffentlich geteilt werden." };
  }
  if (nextOeffentlich && existing.abdeckung_prozent < COVERAGE_THRESHOLD_PERCENT) {
    return {
      error: `Diese Fahrt deckt nur ${Math.round(existing.abdeckung_prozent)}% der Strecke ab und kann daher nicht öffentlich gemacht werden.`,
    };
  }

  const { error } = await supabase
    .from("route_completions")
    .update({ ist_oeffentlich: nextOeffentlich })
    .eq("id", completionId)
    .eq("user_id", user.id);

  if (error) return { error: "Sichtbarkeit konnte nicht geändert werden." };

  revalidatePath("/profil");
  revalidatePath(`/fahrer/${user.id}`);
  revalidatePath(`/strecken/${existing.route_id}`);
  revalidatePath("/leaderboards");
  return { error: null };
}

export interface UpdateNotizState {
  error: string | null;
}

// "Kommentar bearbeiten" im 3-Punkte-Menü der Fahrt-Detailseite
// (CompletionActionsMenu.tsx) — ändert die Notiz einer bereits gespeicherten
// Fahrt nachträglich (RLS erlaubt Update ohnehin nur der eigenen Zeile).
// Gleiche Kürzung wie beim ursprünglichen Eintrag in logTrackedCompletion.
export async function updateCompletionNotiz(
  completionId: string,
  notiz: string,
): Promise<UpdateNotizState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const trimmed = notiz.trim().slice(0, MAX_NOTIZ_LENGTH);

  const { data: existing } = await supabase
    .from("route_completions")
    .select("route_id")
    .eq("id", completionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Fahrt nicht gefunden." };

  const { error } = await supabase
    .from("route_completions")
    .update({ notiz: trimmed || null })
    .eq("id", completionId)
    .eq("user_id", user.id);

  if (error) return { error: "Kommentar konnte nicht gespeichert werden." };

  revalidatePath(`/fahrten/${completionId}`);
  revalidatePath("/profil");
  revalidatePath(`/fahrer/${user.id}`);
  return { error: null };
}

export interface RemovePhotoState {
  error: string | null;
}

// Entfernen-Button je Foto in der Fotos-Galerie der Fahrt-Detailseite
// (app/fahrten/[id]/page.tsx, nur für den Besitzer sichtbar) — löscht das
// Objekt aus dem Storage-Bucket (RLS auf storage.objects, siehe
// 0003_storage.sql, erlaubt das nur im eigenen {user_id}/-Ordner) und die
// zugehörige completion_photos-Zeile. Ab 0036_completion_photos.sql: pro
// Foto statt pro Fahrt, da eine Fahrt jetzt mehrere Fotos haben kann.
export async function removeCompletionPhoto(photoId: string): Promise<RemovePhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { data: existing } = await supabase
    .from("completion_photos")
    .select("completion_id, foto_url, route_completions(route_id)")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .maybeSingle<{
      completion_id: string;
      foto_url: string;
      route_completions: { route_id: string } | null;
    }>();

  if (!existing) return { error: "Foto nicht gefunden." };

  const bucketMarker = `/${ROUTE_PHOTOS_BUCKET}/`;
  const markerIndex = existing.foto_url.indexOf(bucketMarker);
  if (markerIndex !== -1) {
    const path = existing.foto_url.slice(markerIndex + bucketMarker.length);
    await supabase.storage.from(ROUTE_PHOTOS_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from("completion_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", user.id);

  if (error) return { error: "Foto konnte nicht entfernt werden." };

  revalidatePath(`/fahrten/${existing.completion_id}`);
  if (existing.route_completions) {
    revalidatePath(`/strecken/${existing.route_completions.route_id}`);
  }
  revalidatePath("/profil");
  revalidatePath("/feed");
  return { error: null };
}
