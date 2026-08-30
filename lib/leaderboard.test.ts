import { describe, expect, it } from "vitest";
import { aggregateLeaderboards, type LeaderboardRow } from "@/lib/leaderboard";

function row(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    user_id: "u1",
    display_name: "Alice",
    route_id: "r1",
    hoehe_m: 1000,
    effektive_distanz_km: 20,
    ist_premium: false,
    zeigt_premium_badge: false,
    ...overrides,
  };
}

describe("aggregateLeaderboards", () => {
  it("counts distinct routes per user, not total completions", () => {
    const rows = [
      row({ user_id: "u1", route_id: "r1" }),
      row({ user_id: "u1", route_id: "r1" }), // same route driven twice
      row({ user_id: "u1", route_id: "r2" }),
    ];
    const { meistePaesse } = aggregateLeaderboards(rows);
    expect(meistePaesse).toEqual([
      { userId: "u1", name: "Alice", value: 2, isPremiumBadge: false },
    ]);
  });

  it("never shows the premium badge while the Premium feature is disabled", () => {
    const rows = [
      row({ user_id: "u1", ist_premium: true, zeigt_premium_badge: true }),
      row({ user_id: "u2", route_id: "r2", ist_premium: true, zeigt_premium_badge: false }),
    ];
    const { meistePaesse } = aggregateLeaderboards(rows);
    const badgeByUser = new Map(meistePaesse.map((e) => [e.userId, e.isPremiumBadge]));
    expect(badgeByUser.get("u1")).toBe(false);
    expect(badgeByUser.get("u2")).toBe(false);
  });

  it("sums elevation and distance across all completions, including repeats", () => {
    const rows = [
      row({ user_id: "u1", route_id: "r1", hoehe_m: 1000, effektive_distanz_km: 20 }),
      row({ user_id: "u1", route_id: "r1", hoehe_m: 1000, effektive_distanz_km: 20 }),
    ];
    const { meisteHoehenmeter, meisteKm } = aggregateLeaderboards(rows);
    expect(meisteHoehenmeter[0].value).toBe(2000);
    expect(meisteKm[0].value).toBe(40);
  });

  it("falls back to the route length when no GPS distance was tracked", () => {
    const rows = [row({ effektive_distanz_km: null })];
    const { meisteKm } = aggregateLeaderboards(rows);
    expect(meisteKm[0].value).toBe(0);
  });

  it("ranks users by value, highest first, and labels missing names", () => {
    const rows = [
      row({ user_id: "u1", display_name: "Alice", route_id: "r1", hoehe_m: 500 }),
      row({ user_id: "u2", display_name: null, route_id: "r1", hoehe_m: 1500 }),
    ];
    const { meisteHoehenmeter } = aggregateLeaderboards(rows);
    expect(meisteHoehenmeter.map((e) => e.name)).toEqual(["Anonym", "Alice"]);
  });

  it("caps each leaderboard at the top 3 entries", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({ user_id: `u${i}`, display_name: `User ${i}`, route_id: `r${i}`, hoehe_m: i }),
    );
    const { meisteHoehenmeter } = aggregateLeaderboards(rows);
    expect(meisteHoehenmeter).toHaveLength(3);
    expect(meisteHoehenmeter[0].value).toBe(4);
  });
});
