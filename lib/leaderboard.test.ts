import { describe, expect, it } from "vitest";
import {
  aggregateLeaderboards,
  dedupeRouteLeaderboardRows,
  type LeaderboardRow,
  type RouteLeaderboardRow,
} from "@/lib/leaderboard";

function row(overrides: Partial<LeaderboardRow>): LeaderboardRow {
  return {
    user_id: "u1",
    display_name: "Alice",
    avatar_url: null,
    route_id: "r1",
    hoehe_m: 1000,
    effektive_distanz_km: 20,
    ist_premium: false,
    zeigt_premium_badge: false,
    ...overrides,
  };
}

function routeRow(overrides: Partial<RouteLeaderboardRow>): RouteLeaderboardRow {
  return {
    completion_id: "c1",
    user_id: "u1",
    display_name: "Alice",
    avatar_url: null,
    dauer_sekunden: 1000,
    ist_premium: false,
    zeigt_premium_badge: false,
    ...overrides,
  };
}

describe("aggregateLeaderboards", () => {
  it("counts every recorded completion per user, including repeats of the same route", () => {
    const rows = [
      row({ user_id: "u1", route_id: "r1" }),
      row({ user_id: "u1", route_id: "r1" }), // same route driven twice — counts twice
      row({ user_id: "u1", route_id: "r2" }),
    ];
    const { meisteFahrten } = aggregateLeaderboards(rows);
    expect(meisteFahrten).toEqual([
      { userId: "u1", name: "Alice", avatarUrl: null, value: 3, isPremiumBadge: false },
    ]);
  });

  it("passes the already-gated avatar_url through unchanged", () => {
    const rows = [row({ user_id: "u1", avatar_url: "https://example.com/a.jpg" }), row({ user_id: "u2", avatar_url: null })];
    const { meisteFahrten } = aggregateLeaderboards(rows);
    const avatarByUser = new Map(meisteFahrten.map((e) => [e.userId, e.avatarUrl]));
    expect(avatarByUser.get("u1")).toBe("https://example.com/a.jpg");
    expect(avatarByUser.get("u2")).toBeNull();
  });

  it("never shows the premium badge while the Premium feature is disabled", () => {
    const rows = [
      row({ user_id: "u1", ist_premium: true, zeigt_premium_badge: true }),
      row({ user_id: "u2", route_id: "r2", ist_premium: true, zeigt_premium_badge: false }),
    ];
    const { meisteFahrten } = aggregateLeaderboards(rows);
    const badgeByUser = new Map(meisteFahrten.map((e) => [e.userId, e.isPremiumBadge]));
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

  it("counts distinct routes per user for meisteStrecken, not total completions", () => {
    const rows = [
      row({ user_id: "u1", route_id: "r1" }),
      row({ user_id: "u1", route_id: "r1" }), // dieselbe Strecke zweimal gefahren — zählt nur einmal
      row({ user_id: "u1", route_id: "r2" }),
      row({ user_id: "u2", route_id: "r1" }),
    ];
    const { meisteStrecken } = aggregateLeaderboards(rows);
    const byUser = new Map(meisteStrecken.map((e) => [e.userId, e.value]));
    expect(byUser.get("u1")).toBe(2);
    expect(byUser.get("u2")).toBe(1);
  });
});

describe("dedupeRouteLeaderboardRows", () => {
  it("keeps only a user's fastest completion when they appear multiple times", () => {
    const rows = [
      routeRow({ completion_id: "c1", user_id: "u1", dauer_sekunden: 500 }),
      routeRow({ completion_id: "c2", user_id: "u1", dauer_sekunden: 700 }), // langsamere Zweitfahrt
      routeRow({ completion_id: "c3", user_id: "u2", dauer_sekunden: 600 }),
    ];
    const result = dedupeRouteLeaderboardRows(rows, 10);
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map((r) => [r.user_id, r.completion_id]));
    expect(byUser.get("u1")).toBe("c1");
    expect(byUser.get("u2")).toBe("c3");
  });

  it("preserves ascending order by dauer_sekunden and breaks ties by input order", () => {
    const rows = [
      routeRow({ completion_id: "c1", user_id: "u1", dauer_sekunden: 400 }),
      routeRow({ completion_id: "c2", user_id: "u2", dauer_sekunden: 400 }), // Gleichstand mit u1
      routeRow({ completion_id: "c3", user_id: "u3", dauer_sekunden: 900 }),
    ];
    const result = dedupeRouteLeaderboardRows(rows, 10);
    expect(result.map((r) => r.completion_id)).toEqual(["c1", "c2", "c3"]);
  });

  it("returns exactly topN distinct users when more are available", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      routeRow({ completion_id: `c${i}`, user_id: `u${i}`, dauer_sekunden: 100 + i }),
    );
    // jeder Nutzer fährt zusätzlich eine langsamere Zweitrunde
    const secondRuns = rows.map((r) =>
      routeRow({ completion_id: `${r.completion_id}b`, user_id: r.user_id, dauer_sekunden: r.dauer_sekunden + 1000 }),
    );
    const allSorted = [...rows, ...secondRuns].sort((a, b) => a.dauer_sekunden - b.dauer_sekunden);

    const result = dedupeRouteLeaderboardRows(allSorted, 10);
    expect(result).toHaveLength(10);
    expect(new Set(result.map((r) => r.user_id)).size).toBe(10);
    // die zehn schnellsten unterschiedlichen Nutzer, nicht durch Zweitrunden verdrängt
    expect(result.map((r) => r.user_id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `u${i}`),
    );
  });
});
