import { createClient } from "@/lib/supabase/server";
import type { Route } from "@/types/database";

export async function isModerator(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_moderator ?? false;
}

export async function getPendingRoutes(): Promise<Route[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("routes")
    .select("*")
    .eq("status_ok", false)
    .eq("ist_privat", false)
    .is("abgelehnt_am", null)
    .order("created_at", { ascending: true });
  return (data as Route[]) ?? [];
}

export interface RouteReportWithContext {
  id: string;
  routeId: string;
  routeName: string;
  grund: string;
  kommentar: string | null;
  erstelltAm: string;
}

// Getrennte Folgeabfrage für die Streckennamen statt eines embedded Selects
// (route_reports.select("*, routes(name)")) — dasselbe Muster wie
// getRatings() in lib/ratings.ts (dort für Profile), um nicht auf
// PostgREST-Relationship-Inferenz und deren Typinferenz angewiesen zu sein.
export async function getOpenRouteReports(): Promise<RouteReportWithContext[]> {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("route_reports")
    .select("id, route_id, grund, kommentar, erstellt_am")
    .eq("status", "offen")
    .order("erstellt_am", { ascending: true });

  if (!reports || reports.length === 0) return [];

  const routeIds = [...new Set(reports.map((r) => r.route_id))];
  const { data: routes } = await supabase.from("routes").select("id, name").in("id", routeIds);
  const nameById = new Map((routes ?? []).map((r) => [r.id, r.name]));

  return reports.map((r) => ({
    id: r.id,
    routeId: r.route_id,
    routeName: nameById.get(r.route_id) ?? "Unbekannte Strecke",
    grund: r.grund,
    kommentar: r.kommentar,
    erstelltAm: r.erstellt_am,
  }));
}

export interface RatingReportWithContext {
  id: string;
  ratingId: string;
  routeId: string;
  routeName: string;
  ratingKommentar: string | null;
  grund: string;
  kommentar: string | null;
  erstelltAm: string;
}

export async function getOpenRatingReports(): Promise<RatingReportWithContext[]> {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("rating_reports")
    .select("id, rating_id, grund, kommentar, erstellt_am")
    .eq("status", "offen")
    .order("erstellt_am", { ascending: true });

  if (!reports || reports.length === 0) return [];

  const ratingIds = [...new Set(reports.map((r) => r.rating_id))];
  const { data: ratings } = await supabase
    .from("route_ratings")
    .select("id, route_id, kommentar")
    .in("id", ratingIds);
  const ratingById = new Map((ratings ?? []).map((r) => [r.id, r]));

  const routeIds = [...new Set(Array.from(ratingById.values()).map((r) => r.route_id))];
  const { data: routes } = await supabase.from("routes").select("id, name").in("id", routeIds);
  const routeNameById = new Map((routes ?? []).map((r) => [r.id, r.name]));

  return reports.map((r) => {
    // rating_reports.rating_id → route_ratings.id ist "on delete cascade"
    // (0043): eine gemeldete Bewertung, die bereits gelöscht wurde, hätte
    // ihre offenen Meldungen automatisch mitgelöscht — dieser Fall kann
    // hier also nicht auftreten.
    const rating = ratingById.get(r.rating_id)!;
    return {
      id: r.id,
      ratingId: r.rating_id,
      routeId: rating.route_id,
      routeName: routeNameById.get(rating.route_id) ?? "Unbekannte Strecke",
      ratingKommentar: rating.kommentar,
      grund: r.grund,
      kommentar: r.kommentar,
      erstelltAm: r.erstellt_am,
    };
  });
}
