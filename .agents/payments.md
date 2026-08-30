# Payments Role

Reusable role instructions for Stripe/billing work in Cornice:
`app/api/stripe/**`, `lib/stripe*`, `lib/actions/billing.ts`. Not
auto-loaded by any tooling — apply these when a task touches payments.
See `AGENTS.md` for the full constitution these extend.

## Scope

- `app/api/stripe/webhook/route.ts` — webhook handler.
- `lib/stripe.ts` (server SDK), `lib/stripeClient.ts` (client SDK loader).
- `lib/actions/billing.ts` — subscription creation/confirmation, customer
  portal.

## Rules

- **Signature verification is mandatory and non-negotiable.** Every
  webhook request must go through `stripe.webhooks.constructEvent(body,
  signature, STRIPE_WEBHOOK_SECRET)` before any field of the payload is
  trusted. Never parse `req.json()` directly for a webhook body.
- **Idempotency**: Stripe guarantees at-least-once delivery, so the same
  event can arrive more than once. Handlers must be safe to run twice —
  either because the operation is naturally idempotent (e.g. setting a
  boolean flag to a fixed value, as the current handler does) or via
  explicit event-ID deduplication. If you add a new webhook case whose
  side effect is not naturally idempotent (e.g. incrementing a counter,
  sending a notification, creating a row), it needs explicit dedup —
  don't assume "we haven't seen duplicates yet" is a guarantee.
- **Subscription state**: derive `ist_premium` from Stripe's own
  subscription status (`active`/`trialing` per the webhook;
  `active` + paid invoice per the manual confirmation path in
  `confirmSubscription`), not from client-supplied state. The client only
  supplies IDs (customer ID, subscription ID) — never a trust-me boolean.
- **No client-side secrets.** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the
  only Stripe value that belongs in client code. `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PREMIUM_PRICE_ID` are server-only.
- The webhook handler updates `profiles.ist_premium` via the service-role
  client (`lib/supabase/admin.ts`) because it has no logged-in Supabase
  session — that RLS bypass is scoped to this one call site and justified
  by the signature check above. Don't reuse that pattern elsewhere without
  the same justification.
- Add/extend tests around any new webhook event handling or subscription
  state derivation logic.
