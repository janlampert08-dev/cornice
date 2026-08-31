export const HEATMAP_WEEKS = 18;
const DAYS_PER_WEEK = 7;

export interface HeatmapDay {
  dateKey: string; // "YYYY-MM-DD"
  count: number;
}

// Alles in UTC gerechnet (nicht Server-Lokalzeit): route_completions.datum
// ist eine reine Postgres-date-Spalte ohne Zeitzone, von PostgREST als
// "YYYY-MM-DD" serialisiert — .toISOString().slice(0,10) auf einem
// UTC-Mitternacht-Date liefert exakt dasselbe Format zum Abgleich, ohne dass
// die Zeitzone des Server-Prozesses die Kalendertage verschiebt.
export function buildHeatmapDays(
  dates: string[],
  { weeks = HEATMAP_WEEKS, referenceDate = new Date() }: { weeks?: number; referenceDate?: Date } = {},
): HeatmapDay[] {
  const countByDate = new Map<string, number>();
  for (const raw of dates) {
    const key = raw.slice(0, 10);
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
  }

  const today = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  const todayWeekday = (today.getUTCDay() + 6) % 7; // 0 = Montag

  const gridEnd = new Date(today);
  gridEnd.setUTCDate(today.getUTCDate() + (6 - todayWeekday));

  const totalDays = weeks * DAYS_PER_WEEK;
  const gridStart = new Date(gridEnd);
  gridStart.setUTCDate(gridEnd.getUTCDate() - totalDays + 1);

  return Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + i);
    const dateKey = date.toISOString().slice(0, 10);
    return { dateKey, count: countByDate.get(dateKey) ?? 0 };
  });
}
