import { createClient } from "@/lib/supabase/server";

export const PASS_MILESTONES = [1, 5, 10, 25, 50, 100];
export const HOEHENMETER_MILESTONES = [1000, 5000, 10000, 25000, 50000];
export const FAHRTEN_MILESTONES = [1, 10, 25, 50, 100];

export function highestMilestone(value: number, milestones: number[]): number | null {
  const reached = milestones.filter((m) => value >= m);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

export interface AchievementStats {
  passCount: number;
  hoehenmeter: number;
  fahrtenCount: number;
}

// Dieselbe Aggregation wie die Statistiken-Kachelreihe in app/profil/page.tsx
// (Pässe dedupliziert pro Strecke, Höhenmeter daraus summiert), hier separat
// abrufbar für Stellen, die nicht die ganze Profilseite laden — z.B. das
// Teilen-Bild einer einzelnen Fahrt (app/fahrten/[id]/page.tsx).
export async function getUserAchievementStats(userId: string): Promise<AchievementStats> {
  const supabase = await createClient();
  const [{ data: streckenFahrten }, { count: fahrtenCount }] = await Promise.all([
    supabase
      .from("route_completions")
      .select("route_id, routes(hoehe_m)")
      .eq("user_id", userId)
      .eq("art", "strecke")
      .returns<{ route_id: string; routes: { hoehe_m: number | null } | null }[]>(),
    supabase
      .from("route_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("dauer_sekunden", "is", null),
  ]);

  const hoeheProRoute = new Map<string, number>();
  for (const c of streckenFahrten ?? []) {
    if (!hoeheProRoute.has(c.route_id)) hoeheProRoute.set(c.route_id, c.routes?.hoehe_m ?? 0);
  }

  return {
    passCount: hoeheProRoute.size,
    hoehenmeter: [...hoeheProRoute.values()].reduce((sum, h) => sum + h, 0),
    fahrtenCount: fahrtenCount ?? 0,
  };
}

// Für das Teilen-Bild reicht ein einzelner, prominent gezeigter Meilenstein
// statt der ganzen Badge-Reihe. Pässe zuerst, dann Höhenmeter, dann Fahrten —
// eine feste Priorität statt eines Vergleichs über unterschiedliche Einheiten
// hinweg (Pässe vs. Meter vs. Fahrten lassen sich nicht sinnvoll der Grösse
// nach sortieren). Zeigt den aktuell höchsten erreichten Stand, nicht
// zwingend einen gerade eben neu erreichten — es gibt aktuell keine
// Vorher/Nachher-Erkennung einzelner Fahrten.
export function featuredMilestone(stats: AchievementStats): string | null {
  const pass = highestMilestone(stats.passCount, PASS_MILESTONES);
  if (pass !== null) return `${pass} Pässe befahren`;

  const hoehenmeter = highestMilestone(stats.hoehenmeter, HOEHENMETER_MILESTONES);
  if (hoehenmeter !== null) return `${hoehenmeter.toLocaleString("de-CH")} Höhenmeter`;

  const fahrten = highestMilestone(stats.fahrtenCount, FAHRTEN_MILESTONES);
  if (fahrten !== null) return `${fahrten} Fahrten`;

  return null;
}
