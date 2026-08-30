import { describe, expect, it } from "vitest";
import { wasAlreadyProcessed } from "@/lib/stripeWebhook";

// Minimaler Mock für den Teil der Supabase-Query-Builder-API, den
// wasAlreadyProcessed tatsächlich nutzt (.from().insert()).
function makeMockSupabase(error: { code?: string } | null) {
  return {
    from: () => ({
      insert: async () => ({ error }),
    }),
  } as unknown as Parameters<typeof wasAlreadyProcessed>[0];
}

describe("wasAlreadyProcessed", () => {
  it("returns false and records the event on first delivery", async () => {
    const supabase = makeMockSupabase(null);
    expect(await wasAlreadyProcessed(supabase, "evt_1", "checkout.session.completed")).toBe(false);
  });

  it("returns true on a duplicate delivery (unique-violation on the event ID)", async () => {
    const supabase = makeMockSupabase({ code: "23505" });
    expect(await wasAlreadyProcessed(supabase, "evt_1", "checkout.session.completed")).toBe(true);
  });

  it("rethrows on an unrelated database error instead of silently treating it as a duplicate", async () => {
    const supabase = makeMockSupabase({ code: "57014" });
    await expect(wasAlreadyProcessed(supabase, "evt_1", "checkout.session.completed")).rejects.toEqual({
      code: "57014",
    });
  });
});
