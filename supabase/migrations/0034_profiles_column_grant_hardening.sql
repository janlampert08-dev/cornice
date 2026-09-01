-- 0027's column-level REVOKEs on public.profiles (UPDATE on is_moderator/
-- ist_premium/stripe_customer_id, SELECT on stripe_customer_id) turned out
-- to be no-ops: anon/authenticated already held table-level UPDATE and
-- SELECT grants on this table (Supabase's default GRANT ALL ON ALL TABLES
-- IN SCHEMA public), and revoking a column-level privilege never overrides
-- a broader table-level grant in Postgres — it only removes a privilege
-- that was granted at that same column-specific level. Confirmed live via
-- information_schema.table_privileges: authenticated still held full
-- table-level UPDATE and SELECT after 0027 was applied. This means the
-- privilege-escalation hole 0027 describes (any authenticated user could
-- PATCH their own is_moderator/ist_premium to true, or read any user's
-- stripe_customer_id, via a direct PostgREST request) was never actually
-- closed.
--
-- Fix: revoke the table-level grants entirely and re-grant only the
-- specific columns the app's own session-client code (lib/actions/
-- profile.ts, lib/profile.ts, lib/ratings.ts, lib/moderation.ts,
-- lib/completions.ts, app/profil/**, app/willkommen/page.tsx,
-- app/api/strecken/**) actually reads/writes through the user's own
-- session — verified by grepping every from("profiles") call in the repo.
-- stripe_customer_id is read/written exclusively via the service-role
-- client (lib/actions/billing.ts, app/api/stripe/webhook/route.ts), so it
-- needs no anon/authenticated grant at all. No INSERT/DELETE RLS policy
-- exists on profiles (confirmed via pg_policies), so those table-level
-- grants are already inert and left as-is.
--
-- Already applied directly to production ahead of this file (see PR
-- discussion) given the severity — this file brings the migration history
-- back in sync with what's actually live, so a fresh environment built
-- from these migrations alone ends up with the same, correct grants.

revoke update on public.profiles from anon, authenticated;
grant update (
  avatar_url, zeigt_fahrzeuge, zeigt_avatar, zeigt_paesse,
  zeigt_hoehenmeter, zeigt_distanz, zeigt_premium_badge
) on public.profiles to authenticated;

revoke select on public.profiles from anon, authenticated;
grant select (
  id, display_name, created_at, is_moderator, zeigt_fahrzeuge,
  avatar_url, zeigt_avatar, zeigt_paesse, zeigt_hoehenmeter,
  zeigt_distanz, ist_premium, zeigt_premium_badge
) on public.profiles to anon, authenticated;
