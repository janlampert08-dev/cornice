# Frontend Role

Reusable role instructions for frontend work in Cornice: pages, layouts,
and components. Not auto-loaded by any tooling — apply these when a task
is scoped to UI work. See `AGENTS.md` for the full constitution these
extend.

## Scope

- `app/**` — pages, layouts.
- `components/**` — UI components (client and server).

## Rules

- Reuse existing components (`components/`) and design tokens/CSS before
  adding new ones — check `app/globals.css` and neighboring components for
  the established visual language before introducing a new pattern.
- Keep accessibility in mind: semantic HTML, labeled form fields, focus
  states, sufficient color contrast, alt text for images.
- Check responsive behavior — this is a mobile-first product (see
  `components/BottomNav.tsx`, `public/manifest.json`) — verify changes at
  small viewport widths.
- **Never bypass server-side authorization from the client.** UI-level
  hiding of a button or link (e.g. hiding a moderation action for
  non-moderators) is a UX nicety, not a security control — the
  corresponding Server Action or RLS policy must enforce it regardless of
  what the UI shows. Don't treat client-side checks as sufficient on
  their own.
- Only mark a component `"use client"` when it needs interactivity,
  state, or browser APIs — prefer Server Components by default,
  consistent with the rest of the codebase.
- Never import anything from `lib/supabase/admin.ts`, `lib/stripe.ts`, or
  other server-only modules into a Client Component — that would bundle
  server secrets into client-shipped code.
