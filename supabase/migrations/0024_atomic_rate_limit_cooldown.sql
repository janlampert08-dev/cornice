-- lib/rateLimit.ts prüft den Cooldown per SELECT vor einem separaten
-- INSERT/UPSERT — zwei parallele Requests desselben Nutzers (Doppelklick,
-- Skript) können beide den "kein Eintrag im Cooldown-Fenster"-Check
-- bestehen, bevor einer der beiden Inserts committet ist (klassisches
-- TOCTOU). Der App-seitige Check in lib/rateLimit.ts bleibt als schnelles,
-- nutzerfreundliches Vorab-Feedback bestehen, aber die eigentliche
-- Durchsetzung passiert jetzt atomar per Trigger + Advisory-Lock direkt in
-- Postgres: pg_advisory_xact_lock serialisiert konkurrierende Versuche
-- desselben Nutzers für die Dauer der Transaktion, sodass der exists-Check
-- danach garantiert konsistent ist.

-- create-or-replace + drop-trigger-if-exists statt reinem create: die
-- Migrationshistorie dieses Projekts wurde ursprünglich manuell (SQL Editor)
-- statt per CLI geführt, weshalb eine frühere Teilausführung dieser Datei
-- nicht zuverlässig als "angewendet" nachverfolgt war — idempotent
-- formuliert, damit ein erneuter Lauf unabhängig vom bereits vorhandenen
-- Zustand sicher durchläuft.
create or replace function public.enforce_completion_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(1, hashtext(new.user_id::text));

  if exists (
    select 1 from public.route_completions
    where user_id = new.user_id
      and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'cooldown_active';
  end if;

  return new;
end;
$$;

drop trigger if exists route_completions_cooldown on public.route_completions;
create trigger route_completions_cooldown
  before insert on public.route_completions
  for each row execute procedure public.enforce_completion_cooldown();

create or replace function public.enforce_rating_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(2, hashtext(new.user_id::text));

  -- Prüft wie das bisherige App-seitige isRateLimited (lib/rateLimit.ts)
  -- pauschal gegen die letzte Bewertung des Nutzers, unabhängig von der
  -- Strecke — gleiches Verhalten, nur race-frei.
  if exists (
    select 1 from public.route_ratings
    where user_id = new.user_id
      and erstellt_am > now() - interval '3 seconds'
  ) then
    raise exception 'cooldown_active';
  end if;

  return new;
end;
$$;

drop trigger if exists route_ratings_cooldown on public.route_ratings;
create trigger route_ratings_cooldown
  before insert on public.route_ratings
  for each row execute procedure public.enforce_rating_cooldown();
