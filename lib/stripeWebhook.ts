import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// Stripe delivers webhook events at-least-once, so the same event ID can
// arrive more than once (retries, reconnects, duplicate endpoints). This
// records the event ID before processing (supabase/migrations/0026_*) and
// relies on its primary key to make "have we seen this?" atomic even under
// concurrent duplicate deliveries — a unique-violation on insert means
// another request already recorded (and is processing/has processed) this
// exact event ID.
export async function wasAlreadyProcessed(
  supabase: AdminClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { error } = await supabase.from("stripe_webhook_events").insert({ id: eventId, type: eventType });

  if (!error) return false;
  if ((error as { code?: string }).code === "23505") return true;
  throw error;
}
