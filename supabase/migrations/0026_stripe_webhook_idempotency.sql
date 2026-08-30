-- Idempotency guard for the Stripe webhook handler
-- (app/api/stripe/webhook/route.ts). Stripe explicitly documents
-- at-least-once delivery: the same event can be redelivered (retries,
-- reconnects, duplicate endpoints). The handler's current side effects
-- (setting profiles.ist_premium to a fixed boolean) happen to be
-- idempotent already, but relying on that implicitly is fragile — any
-- future event type with a non-idempotent side effect (incrementing a
-- counter, sending a notification, creating a row) would silently
-- double-fire on redelivery. Recording each event ID here before
-- processing makes redelivery a no-op explicitly, for every event type,
-- going forward.
create table public.stripe_webhook_events (
  id text primary key, -- Stripe event ID, e.g. evt_...
  type text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'One row per processed Stripe webhook event ID, used to make redelivery a no-op. Written only by the service-role client from app/api/stripe/webhook/route.ts after signature verification — never exposed to anon/authenticated.';

-- RLS enabled with no policies granted to anon/authenticated: the table is
-- reachable only via the service-role client (lib/supabase/admin.ts),
-- which bypasses RLS entirely. This keeps webhook event metadata out of
-- reach of ordinary users, consistent with the lesson from
-- 0022_stripe_billing.sql / 0023_remove_set_premium_status_rpc.sql that
-- nothing webhook-related should be callable or readable by
-- anon/authenticated.
alter table public.stripe_webhook_events enable row level security;
