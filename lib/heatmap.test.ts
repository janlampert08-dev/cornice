import { describe, expect, it } from "vitest";
import { buildHeatmapDays } from "@/lib/heatmap";

describe("buildHeatmapDays", () => {
  it("returns weeks * 7 days ending on the Sunday of the reference date's week", () => {
    // Mittwoch, 2026-03-11 (UTC)
    const days = buildHeatmapDays([], { weeks: 2, referenceDate: new Date("2026-03-11T12:00:00Z") });
    expect(days).toHaveLength(14);
    expect(days[0].dateKey).toBe("2026-03-02"); // Montag, zwei Wochen vor Wochenende
    expect(days[days.length - 1].dateKey).toBe("2026-03-15"); // Sonntag derselben Woche wie der Stichtag
  });

  it("counts one ride per matching day and zero elsewhere", () => {
    const days = buildHeatmapDays(["2026-03-10", "2026-03-10T00:00:00.000Z"], {
      weeks: 1,
      referenceDate: new Date("2026-03-11T12:00:00Z"),
    });
    const byKey = new Map(days.map((d) => [d.dateKey, d.count]));
    expect(byKey.get("2026-03-10")).toBe(2);
    expect(byKey.get("2026-03-09")).toBe(0);
  });

  it("ignores ride dates outside the requested window", () => {
    const days = buildHeatmapDays(["2020-01-01"], { weeks: 1, referenceDate: new Date("2026-03-11T12:00:00Z") });
    expect(days.every((d) => d.count === 0)).toBe(true);
  });
});
