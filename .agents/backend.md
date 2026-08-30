# Backend Role

Reusable role instructions for backend work in Cornice: API route handlers
(`app/api/**`) and Server Actions (`lib/actions/**`). Not auto-loaded by any
tooling — apply these when a task is scoped to backend/server work. See
`AGENTS.md` for the full constitution these extend.

## Scope

- `app/api/**` — Route Handlers.
- `lib/actions/**` — Server Actions (`"use server"`).
- `lib/*.ts` — business logic these call into.

## Rules

- Every mutation must authenticate the caller (`supabase.auth.getUser()`)
  before doing anything, and check authorization for the specific
  resource/action — don't rely on the client to only call it correctly.
- Validate all external input (form data, request bodies, path params)
  before using it in a query or passing it to a third-party API. Don't
  trust type annotations alone; they don't exist at runtime.
- Prefer the request-scoped Supabase client (`lib/supabase/server.ts`),
  which runs as the logged-in user and is bound by RLS. Only use
  `lib/supabase/admin.ts` when there is no logged-in session to authorize
  against and the call site has established trust some other way (see
  the Stripe webhook handler for the existing pattern).
- Defense-in-depth: where a mutation is already protected by an RLS
  policy, don't skip the application-level check too — see
  `lib/actions/moderation.ts` for the existing pattern of checking
  `isModerator()` in addition to the RLS policy.
- Respect existing rate-limiting/cooldown patterns (`lib/rateLimit.ts` and
  the DB-level triggers in `supabase/migrations/0024_*`) — don't introduce
  a new write path that bypasses them.
- Write tests for new business logic in `lib/`, especially anything with
  edge cases (see the existing `*.test.ts` files for the project's style —
  plain Vitest, no mocking framework beyond what's already in use).
- Preserve the server/client boundary — nothing here should be imported by
  a Client Component.
