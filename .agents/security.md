# Security Role

Reusable role instructions for security review in Cornice. Not
auto-loaded by any tooling — apply these when asked to review a change
for security implications, or use as a checklist before merging changes
to a Protected Area (see `AGENTS.md`).

## Default posture: read-only review

This role reviews and reports; it does not fix by default. If a real
vulnerability is found, it may be fixed only if the fix is small, safe,
and testable, with a regression test added and the fix clearly documented
— otherwise, document the finding and let the owning change decide how to
address it.

## Checklist

**Authentication & session**
- Is every privileged action gated on `supabase.auth.getUser()` (not just
  the presence of a cookie)?
- Does `proxy.ts` / `lib/supabase/middleware.ts` still refresh sessions on
  the paths that need it?

**Authorization / IDOR**
- Can a request substitute another user's/route's ID and access or modify
  data that isn't theirs? Check both the RLS policy and any
  application-level check.
- Are moderator-only or owner-only actions checked server-side, not just
  hidden in the UI?

**RLS**
- Does every table reachable from `lib/supabase/client.ts` or
  `lib/supabase/server.ts` have RLS enabled with policies that match the
  intended access model?
- Is `lib/supabase/admin.ts` (RLS bypass) only used in contexts where
  authorization was independently established (e.g. a verified webhook
  signature), and never reachable from a user-controlled request path
  without that?

**Secrets**
- Any credential, key, or secret in a diff — code, migration, comment,
  test fixture, or committed env file? Block it.
- Any server-only env var (`SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`) referenced from a Client Component or a module
  that a Client Component imports?

**Stripe / payments**
- Does the webhook handler verify `stripe-signature` via
  `constructEvent` before trusting the payload?
- Is processing idempotent/safe if Stripe redelivers the same event
  (at-least-once delivery is expected, not exactly-once)?
- Is the Stripe secret key, webhook secret, or price ID ever exposed to
  the client bundle?

**API abuse / rate limiting**
- Do write-heavy endpoints (completions, ratings) still go through the
  existing cooldown checks (`lib/rateLimit.ts` and the DB-level triggers
  in `supabase/migrations/0024_*`)? A new write path that skips them
  reopens the abuse vector those were built to close.

**File uploads**
- Are uploaded file types/sizes validated server-side, not just via the
  `accept` attribute?
- Does Supabase Storage RLS on the bucket restrict who can read/write
  which paths?

**Server/client boundary**
- Any accidental leak of a server-only value into serialized props,
  client component state, or a `NEXT_PUBLIC_*` variable that shouldn't be
  public?
