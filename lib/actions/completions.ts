"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";
import { computeRouteCoverage, COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";
import { computeTrailStats, type TrailPoint } from "@/lib/geo";
import { getRoute } from "@/lib/routes";

export interface CompletionFormState {
  error: string | null;
}

const ROUTE_PHOTOS_BUCKET = "route-photos";
const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const COMPLETION_COOLDOWN_MS = 5000;
const MAX_NOTIZ_LENGTH = 280;
const MIN_TRAIL_POINTS = 5;
// Grosszügige Obergrenze für die aus Distanz/Dauer abgeleitete
// Durchschnittsgeschwindigkeit — auch auf einer freigegebenen Passstrasse
// unrealistisch, deckt aber jede legitime Fahrt ab. Fängt grob gefälschte
// Trails (z.B. wenige, weit auseinanderliegende Punkte) ab, ohne echte
// GPS-Ungenauigkeit zu bestrafen.
const MAX_PLAUSIBLE_KMH = 200;

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
  const foto = formData.get("foto") as File | null;

  // distanz_km/dauer_sekunden/abdeckung_prozent kommen NICHT vom Client —
  // die liessen sich beliebig fälschen (z.B. abdeckung_prozent=100,
  // dauer_sekunden=1 ohne je gefahren zu sein). Stattdessen wird alles aus
  // dem rohen GPS-Trail neu berechnet, denselben Algorithmen wie im Client
  // (für sofortiges UI-Feedback im Fazit-Screen), aber hier als einzige
  // massgebliche Quelle für Bestenlisten/Statistiken.
  let trail: TrailPoint[];
  try {
    const parsed = JSON.parse(String(formData.get("trail") ?? "[]"));
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (p) =>
          p &&
          typeof p.lng === "number" &&
          typeof p.lat === "number" &&
          typeof p.t === "number",
      )
    ) {
      return { error: "Ungültige Tracking-Daten." };
    }
    trail = parsed as TrailPoint[];
  } catch {
    return { error: "Ungültige Tracking-Daten." };
  }

  if (trail.length < MIN_TRAIL_POINTS) return { error: "Ungültige Tracking-Daten." };

  const route = await getRoute(routeId);
  if (!route) return { error: "Strecke nicht gefunden." };

  const { distanceKm: distanzKm, durationSeconds: dauerSekunden } = computeTrailStats(trail);
  const abdeckungProzent = computeRouteCoverage(
    route.geometry_geojson.coordinates as [number, number][],
    trail.map((p) => [p.lng, p.lat] as [number, number]),
  );

  if (!(distanzKm > 0) || dauerSekunden <= 0) return { error: "Ungültige Tracking-Daten." };

  const avgKmh = distanzKm / (dauerSekunden / 3600);
  if (avgKmh > MAX_PLAUSIBLE_KMH) {
    return { error: "Unrealistische Durchschnittsgeschwindigkeit erkannt." };
  }

  // Serverseitig erzwungen, nicht nur im UI verhindert: unabhängig davon, was
  // das Formular schickt, kann eine Fahrt unterhalb des Deckungsgrad-
  // Schwellenwerts nicht öffentlich sein (siehe lib/routeCoverage.ts).
  const istOeffentlich = requestedOeffentlich && abdeckungProzent >= COVERAGE_THRESHOLD_PERCENT;

  let fotoUrl: string | null = null;
  if (foto && foto.size > 0) {
    const result = await uploadFoto(supabase, user.id, foto);
    if ("error" in result) return { error: result.error };
    fotoUrl = result.url;
  }

  const { error } = await supabase.from("route_completions").insert({
    route_id: routeId,
    user_id: user.id,
    fahrzeug_id: fahrzeugId,
    datum: new Date().toISOString().slice(0, 10),
    foto_url: fotoUrl,
    distanz_km: distanzKm,
    dauer_sekunden: dauerSekunden,
    ist_oeffentlich: istOeffentlich,
    abdeckung_prozent: abdeckungProzent,
    notiz,
  });

  if (error) {
    // Race-freie Durchsetzung via DB-Trigger (0024) — der App-seitige Check
    // oben ist nur ein schnelles Vorab-Feedback und kann bei parallelen
    // Requests theoretisch durchrutschen.
    if (error.message.includes("cooldown_active")) {
      return { error: "Bitte warte einen Moment, bevor du erneut einträgst." };
    }
    return { error: "Fahrt konnte nicht gespeichert werden." };
  }

  revalidatePath(`/strecken/${routeId}`);
  revalidatePath("/profil");
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
    .select("route_id, ist_oeffentlich, abdeckung_prozent")
    .eq("id", completionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Fahrt nicht gefunden." };

  const nextOeffentlich = !existing.ist_oeffentlich;
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

export interface RemovePhotoState {
  error: string | null;
}

// X-Button auf der Fahrt-Detailseite (app/fahrten/[id]/page.tsx, nur für den
// Besitzer sichtbar) — löscht das Objekt aus dem Storage-Bucket (RLS auf
// storage.objects, siehe 0003_storage.sql, erlaubt das nur im eigenen
// {user_id}/-Ordner) und setzt foto_url zurück auf null. Kein
// Berechtigungsproblem, falls der Storage-Löschversuch selbst fehlschlägt
// (z.B. Objekt bereits weg) — best effort, die eigentliche Sichtbarkeit hängt
// allein an route_completions.foto_url.
export async function removeCompletionPhoto(
  completionId: string,
): Promise<RemovePhotoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  const { data: existing } = await supabase
    .from("route_completions")
    .select("route_id, foto_url")
    .eq("id", completionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Fahrt nicht gefunden." };
  if (!existing.foto_url) return { error: null };

  const bucketMarker = `/${ROUTE_PHOTOS_BUCKET}/`;
  const markerIndex = existing.foto_url.indexOf(bucketMarker);
  if (markerIndex !== -1) {
    const path = existing.foto_url.slice(markerIndex + bucketMarker.length);
    await supabase.storage.from(ROUTE_PHOTOS_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from("route_completions")
    .update({ foto_url: null })
    .eq("id", completionId)
    .eq("user_id", user.id);

  if (error) return { error: "Foto konnte nicht entfernt werden." };

  revalidatePath(`/fahrten/${completionId}`);
  revalidatePath(`/strecken/${existing.route_id}`);
  revalidatePath("/profil");
  revalidatePath("/feed");
  return { error: null };
}
