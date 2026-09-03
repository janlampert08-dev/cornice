import { describe, it, expect } from "vitest";
import { getNavItems } from "@/lib/nav";

function hrefs(items: { href: string }[]): string[] {
  return items.map((item) => item.href);
}

describe("getNavItems", () => {
  it("zeigt abgemeldeten Besuchern nur Strecken und Anmelden", () => {
    for (const surface of ["header", "bottom"] as const) {
      expect(hrefs(getNavItems({ loggedIn: false, moderator: false, surface }))).toEqual([
        "/",
        "/anmelden",
      ]);
    }
  });

  // Der Header ist eine Textleiste mit horizontalem Überlauf — dort passen
  // beide Aktionen nebeneinander. Genau das war der Fehler, den diese Tests
  // absichern: "Aufzeichnen" existierte nur in der mobilen Leiste, auf dem
  // Desktop gab es keinen Weg zur freien Fahrt.
  it("führt im Header sowohl Aufzeichnen als auch Vorschlagen", () => {
    const items = hrefs(getNavItems({ loggedIn: true, moderator: false, surface: "header" }));
    expect(items).toContain("/fahrten/neu");
    expect(items).toContain("/strecken/neu");
  });

  it("nutzt den Header als Standard-Surface", () => {
    expect(getNavItems({ loggedIn: true, moderator: false })).toEqual(
      getNavItems({ loggedIn: true, moderator: false, surface: "header" }),
    );
  });

  // Sechs Tabs wären auf schmalen Geräten zu eng; der Streckenvorschlag
  // steht dort stattdessen prominent auf /profil.
  it("lässt in der mobilen Leiste Vorschlagen weg und zeigt nur Aufzeichnen", () => {
    const items = hrefs(getNavItems({ loggedIn: true, moderator: false, surface: "bottom" }));
    expect(items).toEqual(["/", "/feed", "/fahrten/neu", "/leaderboards", "/profil"]);
  });

  it("hängt Moderation nur für Moderatoren an, in beiden Surfaces", () => {
    for (const surface of ["header", "bottom"] as const) {
      expect(hrefs(getNavItems({ loggedIn: true, moderator: true, surface }))).toContain(
        "/moderation",
      );
      expect(hrefs(getNavItems({ loggedIn: true, moderator: false, surface }))).not.toContain(
        "/moderation",
      );
    }
  });

  it("hält Aufzeichnen in der mobilen Leiste an der mittleren Position", () => {
    const items = getNavItems({ loggedIn: true, moderator: true, surface: "bottom" });
    expect(items).toHaveLength(6);
    expect(items[2].href).toBe("/fahrten/neu");
  });
});
