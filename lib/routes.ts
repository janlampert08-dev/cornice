import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RouteGeoJSON } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRoutes(): Promise<{ routes: RouteGeoJSON[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes_geojson")
    .select("*")
    .eq("status_ok", true)
    .order("name");

  if (error) {
    console.error("Strecken konnten nicht geladen werden:", error.message);
    return { routes: [], error: true };
  }

  return { routes: (data as RouteGeoJSON[]) ?? [], error: false };
}

// Wirft bei einem echten Ladefehler (statt "nicht gefunden" mit null
// zurückzugeben), damit der aufrufenden Seite ein error.tsx-Boundary greift
// und nicht fälschlich eine 404 angezeigt wird.
//
// Mit React cache() umschlossen: generateMetadata, die Page selbst und
// opengraph-image.tsx rufen getRoute(id) für denselben Request unabhängig
// voneinander auf — ohne Memoisierung wäre das dieselbe DB-Abfrage
// dreifach pro Seitenaufruf.
// Kandidaten für die automatische Streckenerkennung innerhalb einer freien
// Fahrt (lib/lapDetection.ts) — Rundstrecken, die der Nutzer überhaupt
// completen dürfte: freigegeben, und private Strecken nur die eigenen. Ohne
// diesen Filter könnte das blosse Vorbeifahren an einer fremden privaten
// Strecke deren Existenz indirekt verraten (siehe PR-Beschreibung). Dieselbe
// Bedingung wird in der RPC-Funktion save_free_ride_with_segments
// (0050_streckenerkennung_in_freier_fahrt.sql) nochmal serverseitig geprüft
// — diese Abfrage allein ist kein Sicherheitsmechanismus, nur die
// Vorauswahl für den Normalfall (App-Nutzung).
//
// Genutzt sowohl vom Erkennungsschritt in logFreeRide als auch — falls
// später ein Live-Hinweis während der Fahrt dazukommt — von einem
// entsprechenden Read-Pfad fürs Frontend; eine Stelle statt zwei.
export async function listLoopRouteCandidates(viewerId: string): Promise<RouteGeoJSON[]> {
  // viewerId fliesst unten als Rohtext in einen .or()-Filterstring ein
  // (PostgREST kennt dafür keine parametrisierte Alternative) — hier
  // validieren statt blind zu vertrauen, dass der Aufrufer immer eine echte
  // auth.uid() übergibt.
  if (!UUID_RE.test(viewerId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes_geojson")
    .select("*")
    .eq("ist_rundfahrt", true)
    .eq("status_ok", true)
    .or(`ist_privat.eq.false,erstellt_von.eq.${viewerId}`);

  if (error) {
    console.error("Kandidatenstrecken konnten nicht geladen werden:", error.message);
    return [];
  }

  return (data as RouteGeoJSON[]) ?? [];
}

export const getRoute = cache(async function getRoute(id: string): Promise<RouteGeoJSON | null> {
  if (!UUID_RE.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routes_geojson")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Strecke konnte nicht geladen werden:", error.message);
    throw new Error("Strecke konnte nicht geladen werden.");
  }

  return data as RouteGeoJSON;
});
