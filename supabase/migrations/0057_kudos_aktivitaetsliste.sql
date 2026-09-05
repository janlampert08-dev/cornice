-- Ergänzt count_unseen_kudos (0053_kudos_gesehen.sql) um eine tatsächliche
-- Liste statt nur einer Zahl: Grundlage für /aktivitaet, den neuen
-- Desktop-Header-Eintrag für "Community reagiert" (siehe AGENTS.md, "Core
-- User Loop", Schritt 7→8) — bisher war der Rückkanal nur ein Badge auf dem
-- Profil-Tab, ohne eigene Stelle, an der die einzelnen Kudos auch sichtbar
-- werden.

-- SECURITY DEFINER aus denselben zwei Gründen wie count_unseen_kudos: (1)
-- liest profiles.kudos_gesehen_am, das bewusst keinen Spalten-Grant an
-- authenticated trägt (siehe Kommentar dort), um den "neu"-Flag pro Zeile zu
-- berechnen, und (2) ein normaler authenticated-Client könnte den Join
-- zwischen kudos, route_completions und profiles ohnehin nicht als einzelne
-- Abfrage über PostgREST ausdrücken. Nimmt keine Parameter entgegen und
-- arbeitet ausschliesslich mit auth.uid() -- liefert immer nur die eigenen
-- erhaltenen Kudos des eingeloggten Nutzers, mit einem festen Limit statt
-- eines vom Aufrufer wählbaren (kein Bedarf für Pagination bei einer reinen
-- "letzte Reaktionen"-Liste).
create function public.recent_kudos_received()
returns table (
  completion_id uuid,
  giver_id uuid,
  giver_display_name text,
  giver_avatar_url text,
  erstellt_am timestamptz,
  neu boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    k.completion_id,
    k.user_id as giver_id,
    p.display_name as giver_display_name,
    p.avatar_url as giver_avatar_url,
    k.erstellt_am,
    k.erstellt_am > (
      select pr.kudos_gesehen_am from public.profiles pr where pr.id = auth.uid()
    ) as neu
  from public.kudos k
  join public.route_completions rc on rc.id = k.completion_id
  join public.profiles p on p.id = k.user_id
  where rc.user_id = auth.uid()
  order by k.erstellt_am desc
  limit 30;
$$;

comment on function public.recent_kudos_received() is
  'Die letzten (max. 30) Kudos auf den eigenen Fahrten des eingeloggten Nutzers, inkl. eines "neu"-Flags relativ zu profiles.kudos_gesehen_am. Nur fuer auth.uid() selbst, siehe count_unseen_kudos (0053_kudos_gesehen.sql).';

revoke execute on function public.recent_kudos_received() from public;
revoke execute on function public.recent_kudos_received() from anon;
grant execute on function public.recent_kudos_received() to authenticated;
