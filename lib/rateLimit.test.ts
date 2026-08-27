import { describe, expect, it } from "vitest";
import { isRateLimited } from "@/lib/rateLimit";

// Minimaler Chainable-Mock für den Teil der Supabase-Query-Builder-API, den
// isRateLimited tatsächlich nutzt (.from().select().eq().order().limit().maybeSingle()).
function makeMockSupabase(row: Record<string, string> | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as unknown as Parameters<typeof isRateLimited>[0];
}

describe("isRateLimited", () => {
  it("is not limited when the user has no prior rows", async () => {
    const supabase = makeMockSupabase(null);
    expect(await isRateLimited(supabase, "t", "created_at", "user_id", "u1", 5000)).toBe(false);
  });

  it("is limited when the last row is within the cooldown window", async () => {
    const supabase = makeMockSupabase({ created_at: new Date().toISOString() });
    expect(await isRateLimited(supabase, "t", "created_at", "user_id", "u1", 5000)).toBe(true);
  });

  it("is not limited once the cooldown window has passed", async () => {
    const old = new Date(Date.now() - 10_000).toISOString();
    const supabase = makeMockSupabase({ created_at: old });
    expect(await isRateLimited(supabase, "t", "created_at", "user_id", "u1", 5000)).toBe(false);
  });
});
