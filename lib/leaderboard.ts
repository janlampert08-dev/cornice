import { createClient } from "@/lib/supabase/server";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  value: number;
  isPremiumBadge: boolean;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
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
  avatarUrls: Map<string, string | null>,
): LeaderboardEntry[] {
  return Array.from(values.entries())
    .map(([userId, value]) => ({
      userId,
      name: names.get(userId) ?? "Anonym",
      // avatar_url kommt bereits serverseitig mit dem zeigt_avatar-Opt-in
      // verrechnet aus der View (siehe 0028_leaderboard_avatar.sql) — hier
      // nur noch durchgereicht, keine weitere Prüfung nötig.
      avatarUrl: avatarUrls.get(userId) ?? null,
      value,
      // Premium-Feature (Gold-Badge) vorerst deaktiviert.
      isPremiumBadge: false,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

// Vier bewusst nicht-zeitbezogene Bestenlisten (siehe 0013_leaderboard_view.sql
// für die Begründung) — belohnen Distanz/Höhenmeter/Anzahl aufgezeichneter
// Fahrten/unterschiedlicher Strecken, nie Geschwindigkeit.
export function aggregateLeaderboards(rows: LeaderboardRow[]): {
  meisteFahrten: LeaderboardEntry[];
  meisteHoehenmeter: LeaderboardEntry[];
  meisteKm: LeaderboardEntry[];
  meisteStrecken: LeaderboardEntry[];
} {
  const names = new Map<string, string>();
  const avatarUrls = new Map<string, string | null>();
  const fahrtenByUser = new Map<string, number>();
  const hoehenmeterByUser = new Map<string, number>();
  const kmByUser = new Map<string, number>();
  const streckenByUser = new Map<string, Set<string>>();

  for (const row of rows) {
    names.set(row.user_id, row.display_name ?? "Anonym");
    avatarUrls.set(row.user_id, row.avatar_url);

    // Jede Aufzeichnung zählt, auch mehrfach gefahrene Strecken — im
    // Gegensatz zu passCount (lib/profile.ts), das pro Strecke dedupliziert.
    fahrtenByUser.set(row.user_id, (fahrtenByUser.get(row.user_id) ?? 0) + 1);

    hoehenmeterByUser.set(row.user_id, (hoehenmeterByUser.get(row.user_id) ?? 0) + (row.hoehe_m ?? 0));
    kmByUser.set(row.user_id, (kmByUser.get(row.user_id) ?? 0) + (row.effektive_distanz_km ?? 0));

    // "Entdecker": Anzahl unterschiedlicher Strecken statt reiner
    // Fahrtenzahl — belohnt Vielfalt auch für Nutzer, die nie an die Spitze
    // der Distanz-/Höhenmeter-Rangliste kommen. Hiess zuvor "Stammfahrer",
    // was sprachlich das Gegenteil suggerierte (Treue zu derselben Strecke,
    // wie Stravas "Local Legend" — meiste Fahrten auf einer Strecke). Bewusst
    // ohne Zeitfenster: leaderboard_completions liefert kein Datum; ein
    // Rolling-Window wäre eine eigene View-Änderung (Migration) und ist
    // nicht Teil dieser Phase.
    if (!streckenByUser.has(row.user_id)) streckenByUser.set(row.user_id, new Set());
    streckenByUser.get(row.user_id)!.add(row.route_id);
  }

  const streckenCountByUser = new Map<string, number>(
    [...streckenByUser.entries()].map(([userId, routeIds]) => [userId, routeIds.size]),
  );

  return {
    meisteFahrten: toTopEntries(fahrtenByUser, names, avatarUrls),
    meisteHoehenmeter: toTopEntries(hoehenmeterByUser, names, avatarUrls),
    meisteKm: toTopEntries(kmByUser, names, avatarUrls),
    meisteStrecken: toTopEntries(streckenCountByUser, names, avatarUrls),
  };
}

export async function getGlobalLeaderboards(): Promise<
  ReturnType<typeof aggregateLeaderboards>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leaderboard_completions").select("*");

  if (error || !data) {
    return { meisteFahrten: [], meisteHoehenmeter: [], meisteKm: [], meisteStrecken: [] };
  }

  return aggregateLeaderboards(data as LeaderboardRow[]);
}

export interface RouteTimeEntry {
  completionId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  dauerSekunden: number;
  isPremiumBadge: boolean;
}

export interface RouteLeaderboardRow {
  completion_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  dauer_sekunden: number;
  ist_premium: boolean;
  zeigt_premium_badge: boolean;
}

const ROUTE_TOP_N = 10;

// route_leaderboard liefert eine Zeile pro opted-in Fahrt, nicht pro Nutzer —
// wir holen daher deutlich mehr Zeilen als ROUTE_TOP_N und deduplizieren in JS
// auf die schnellste Fahrt pro Nutzer (siehe dedupeRouteLeaderboardRows), statt
// mehrere Zeiten desselben Fahrers in der Bestenliste zuzulassen.
const ROUTE_FETCH_LIMIT = 200;

// Reine Reduktion (kein DB-Zugriff), daher separat testbar: pro user_id nur
// die schnellste Fahrt behalten und auf die Top N unterschiedlichen Nutzer
// kürzen. Setzt voraus, dass rows bereits aufsteigend nach dauer_sekunden
// sortiert sind — das erste Vorkommen eines Nutzers ist dann seine Bestzeit.
export function dedupeRouteLeaderboardRows(
  rows: RouteLeaderboardRow[],
  topN: number,
): RouteLeaderboardRow[] {
  const seenUsers = new Set<string>();
  const result: RouteLeaderboardRow[] = [];

  for (const row of rows) {
    if (seenUsers.has(row.user_id)) continue;
    seenUsers.add(row.user_id);
    result.push(row);
    if (result.length >= topN) break;
  }

  return result;
}

// Nur Fahrten mit aktivem Opt-in (route_leaderboard-View, siehe
// 0014_route_leaderboard_optin.sql) — sortiert nach kürzester Zeit.
export async function getRouteLeaderboard(routeId: string): Promise<RouteTimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("route_leaderboard")
    .select("completion_id, user_id, display_name, avatar_url, dauer_sekunden, ist_premium, zeigt_premium_badge")
    .eq("route_id", routeId)
    .order("dauer_sekunden", { ascending: true })
    .limit(ROUTE_FETCH_LIMIT);

  if (error || !data) return [];

  const deduped = dedupeRouteLeaderboardRows(data as RouteLeaderboardRow[], ROUTE_TOP_N);

  return deduped.map((r) => ({
    completionId: r.completion_id,
    userId: r.user_id,
    name: r.display_name ?? "Anonym",
    // Bereits serverseitig mit zeigt_avatar verrechnet (0028_leaderboard_avatar.sql).
    avatarUrl: r.avatar_url,
    dauerSekunden: r.dauer_sekunden,
    // Premium-Feature (Gold-Badge) vorerst deaktiviert.
    isPremiumBadge: false,
  }));
}
