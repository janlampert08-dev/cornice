import { describe, expect, it } from "vitest";
import { firstPhotoPerRoute } from "@/lib/photos";

describe("firstPhotoPerRoute", () => {
  it("keeps only the first (newest) photo per route", () => {
    const covers = firstPhotoPerRoute([
      { route_id: "r1", foto_url: "newest.jpg", datum: "2026-06-01" },
      { route_id: "r1", foto_url: "older.jpg", datum: "2026-01-01" },
      { route_id: "r2", foto_url: "r2.jpg", datum: "2026-03-01" },
    ]);

    expect(covers.get("r1")).toBe("newest.jpg");
    expect(covers.get("r2")).toBe("r2.jpg");
    expect(covers.size).toBe(2);
  });

  it("returns an empty map for no rows", () => {
    expect(firstPhotoPerRoute([]).size).toBe(0);
  });
});
