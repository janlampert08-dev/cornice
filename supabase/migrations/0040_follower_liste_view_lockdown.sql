-- CodeRabbit finding on PR "Add opt-in to hide follower/following LISTS from
-- other viewers": public_follows (0037) is granted select to anon and
-- authenticated directly. 0039's zeigt_follower_liste check only lives in
-- application code (app/fahrer/[id]/page.tsx) — anyone with the publishable
-- key can bypass it entirely by querying the view straight through PostgREST
-- (e.g. ?followed_id=eq.<id>&select=follower_display_name,...), which is
-- exactly what 0039 was meant to prevent. Confirmed: AGENTS.md is explicit
-- that RLS/grants are the actual authorization boundary, not a page-level
-- check — "any table reachable from the browser client... is only as safe
-- as its RLS policies."
--
-- Fix: revoke direct select on public_follows from anon/authenticated. Counts
-- and lists now go through two SECURITY DEFINER functions instead of the raw
-- view. Counts stay unconditionally public (0037's decision, unchanged).
-- Lists enforce zeigt_follower_liste server-side, with a bypass for the
-- profile's own owner (auth.uid() = p_user_id) so a signed-in user always
-- sees their own full list regardless of the flag — same rule 0039 already
-- described, now actually enforced instead of merely assumed by the caller.

revoke select on public.public_follows from anon, authenticated;

create or replace function public.get_follow_counts(p_user_id uuid)
returns table(followers integer, following integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.public_follows where followed_id = p_user_id)::integer as followers,
    (select count(*) from public.public_follows where follower_id = p_user_id)::integer as following;
$$;

comment on function public.get_follow_counts(uuid) is
  'Follower-/Following-Zahlen, ausnahmslos oeffentlich (0037_public_follows.sql, hier unveraendert). SECURITY DEFINER, da public_follows selbst nicht mehr direkt an anon/authenticated gegrantet ist (0040) -- die Funktion ist der einzige verbleibende Zugriffspfad und liest ausschliesslich Zaehlwerte, keine personenbezogenen Listendaten.';

grant execute on function public.get_follow_counts(uuid) to anon, authenticated;

create or replace function public.get_follower_list(p_user_id uuid)
returns table(follower_id uuid, follower_display_name text, follower_avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select pf.follower_id, pf.follower_display_name, pf.follower_avatar_url
  from public.public_follows pf
  where pf.followed_id = p_user_id
    and (
      auth.uid() = p_user_id
      or exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.zeigt_follower_liste
      )
    );
$$;

comment on function public.get_follower_list(uuid) is
  'Follower-LISTE (Namen+Avatar) -- respektiert zeigt_follower_liste (0039) serverseitig, ausser fuer den Profil-Besitzer selbst (auth.uid() = p_user_id), der seine eigene Liste immer sieht. SECURITY DEFINER aus demselben Grund wie get_follow_counts; die Sichtbarkeitsentscheidung steht explizit in der WHERE-Klausel, nicht implizit beim Aufrufer.';

grant execute on function public.get_follower_list(uuid) to anon, authenticated;

create or replace function public.get_following_list(p_user_id uuid)
returns table(followed_id uuid, followed_display_name text, followed_avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select pf.followed_id, pf.followed_display_name, pf.followed_avatar_url
  from public.public_follows pf
  where pf.follower_id = p_user_id
    and (
      auth.uid() = p_user_id
      or exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.zeigt_follower_liste
      )
    );
$$;

comment on function public.get_following_list(uuid) is
  'Following-LISTE (Namen+Avatar) -- analog get_follower_list.';

grant execute on function public.get_following_list(uuid) to anon, authenticated;
