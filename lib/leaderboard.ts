import { createClient } from "@/lib/supabase/server";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  isPremiumBadge: boolean;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  route_id: string;
  hoehe_m: number | null;
  effektive_distanz_km: number | null;
  ist_premium: boolean;
  zeigt_premium_badge: boolean;
}

const TOP_N = 3;

function toTopEntries(
  values: Map<string, number>,
  names: Map<string, string>,
): LeaderboardEntry[] {
  return Array.from(values.entries())
    .map(([userId, value]) => ({
      userId,
      name: names.get(userId) ?? "Anonym",
      value,
      // Premium-Feature (Gold-Badge) vorerst deaktiviert.
      isPremiumBadge: false,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

// Drei bewusst nicht-zeitbezogene Bestenlisten (siehe 0013_leaderboard_view.sql
// für die Begründung) — belohnen Distanz/Höhenmeter/Anzahl befahrener Pässe,
// nie Geschwindigkeit.
export function aggregateLeaderboards(rows: LeaderboardRow[]): {
  meistePaesse: LeaderboardEntry[];
  meisteHoehenmeter: LeaderboardEntry[];
  meisteKm: LeaderboardEntry[];
} {
  const names = new Map<string, string>();
  const routesByUser = new Map<string, Set<string>>();
  const hoehenmeterByUser = new Map<string, number>();
  const kmByUser = new Map<string, number>();

  for (const row of rows) {
    names.set(row.user_id, row.display_name ?? "Anonym");

    const routes = routesByUser.get(row.user_id) ?? new Set<string>();
    routes.add(row.route_id);
    routesByUser.set(row.user_id, routes);

    hoehenmeterByUser.set(row.user_id, (hoehenmeterByUser.get(row.user_id) ?? 0) + (row.hoehe_m ?? 0));
    kmByUser.set(row.user_id, (kmByUser.get(row.user_id) ?? 0) + (row.effektive_distanz_km ?? 0));
  }

  const paesseByUser = new Map(
    Array.from(routesByUser.entries()).map(([userId, routes]) => [userId, routes.size]),
  );

  return {
    meistePaesse: toTopEntries(paesseByUser, names),
    meisteHoehenmeter: toTopEntries(hoehenmeterByUser, names),
    meisteKm: toTopEntries(kmByUser, names),
  };
}

export async function getGlobalLeaderboards(): Promise<
  ReturnType<typeof aggregateLeaderboards>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leaderboard_completions").select("*");

  if (error || !data) {
    return { meistePaesse: [], meisteHoehenmeter: [], meisteKm: [] };
  }

  return aggregateLeaderboards(data as LeaderboardRow[]);
}

export interface RouteTimeEntry {
  completionId: string;
  userId: string;
  name: string;
  dauerSekunden: number;
  isPremiumBadge: boolean;
}

interface RouteLeaderboardRow {
  completion_id: string;
  user_id: string;
  display_name: string | null;
  dauer_sekunden: number;
  ist_premium: boolean;
  zeigt_premium_badge: boolean;
}

const ROUTE_TOP_N = 10;

// Nur Fahrten mit aktivem Opt-in (route_leaderboard-View, siehe
// 0014_route_leaderboard_optin.sql) — sortiert nach kürzester Zeit.
export async function getRouteLeaderboard(routeId: string): Promise<RouteTimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_leaderboard")
    .select("completion_id, user_id, display_name, dauer_sekunden, ist_premium, zeigt_premium_badge")
    .eq("route_id", routeId)
    .order("dauer_sekunden", { ascending: true })
    .limit(ROUTE_TOP_N);

  if (error || !data) return [];

  return (data as RouteLeaderboardRow[]).map((r) => ({
    completionId: r.completion_id,
    userId: r.user_id,
    name: r.display_name ?? "Anonym",
    dauerSekunden: r.dauer_sekunden,
    // Premium-Feature (Gold-Badge) vorerst deaktiviert.
    isPremiumBadge: false,
  }));
}
