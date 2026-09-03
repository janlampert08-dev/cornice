-- Automatische Streckenerkennung innerhalb einer freien Fahrt: eine lange,
-- frei aufgezeichnete Fahrt (z.B. drei Stunden Samstagabend) kann unterwegs
-- eine oder mehrere kuratierte Rundstrecken vollständig abdecken, unabhängig
-- davon, an welchem Punkt der Runde eingestiegen wurde. Die eigentliche
-- Erkennung (Kandidatensuche, Rundenerkennung mit Bogenlängen-Projektion)
-- läuft ausschliesslich in TypeScript (lib/lapDetection.ts, Vitest-getestet)
-- — diese Migration liefert nur die Persistenz dafür:
--
--   1. Zwei neue Spalten auf route_completions.
--   2. Eine gezielte, eng gefasste Ausnahme im Cooldown-Trigger (0024).
--   3. Eine RPC-Funktion, die die freie Fahrt und ihre erkannten Abschnitte
--      atomar anlegt.

alter table public.route_completions
  add column parent_completion_id uuid references public.route_completions (id) on delete set null,
  add column erkennung_automatisch boolean not null default false;

create index route_completions_parent_completion_id_idx
  on public.route_completions (parent_completion_id);

comment on column public.route_completions.parent_completion_id is
  'Bei einem automatisch aus einer freien Fahrt erkannten Streckenabschnitt: Verweis auf die übergeordnete freie Fahrt (art = ''frei''). NULL bei allen anderen Fahrten. ON DELETE SET NULL: löscht der Nutzer die übergeordnete freie Fahrt, bleiben die einzeln erkannten Streckenfahrten als eigenständige Einträge (eigener Track, eigenes Leaderboard-Ergebnis) bestehen, statt automatisch mitgelöscht zu werden. Bewusst nicht Teil der öffentlichen Views (public_fahrten & Co.) — die laufen mit den Rechten ihres Owners und bypassen RLS; die Verknüpfung bleibt vorerst ausschliesslich dem Besitzer selbst sichtbar (RLS-geschützte Basistabelle), siehe PR-Beschreibung.';
comment on column public.route_completions.erkennung_automatisch is
  'true, wenn diese Streckenfahrt automatisch aus einer freien Fahrt erkannt wurde (lib/lapDetection.ts), statt explizit über die Streckenseite gestartet zu werden. Rein informativ (Badge), an keiner Policy oder Berechnung beteiligt.';

-- ---------------------------------------------------------------------------
-- Cooldown-Trigger (0024): erlaubt eine einzige, eng gefasste Ausnahme,
-- keine generelle Aufweichung. Ohne sie würde jeder zweite Insert eines
-- erkannten Abschnitts innerhalb derselben Fahrt garantiert mit
-- "cooldown_active" scheitern — der Trigger prüft pro Zeile, und bereits
-- eingefügte Zeilen desselben Statements/derselben Transaktion sind für die
-- Prüfung der nächsten Zeile bereits sichtbar.
--
-- Die Ausnahme greift ausschliesslich innerhalb der Transaktion von
-- save_free_ride_with_segments (siehe unten) über eine transaktionslokale
-- Einstellung. Sie ist von aussen nicht direkt setzbar: set_config liegt in
-- pg_catalog, PostgREST exponiert nur Funktionen aus dem public-Schema als
-- RPC — es entsteht also kein neuer, von der App unabhängiger Umgehungsweg
-- für den Cooldown. Die Elternzeile (die freie Fahrt selbst) durchläuft die
-- normale Prüfung unverändert zuerst; erst danach wird die Ausnahme für die
-- Kindzeilen derselben, bereits geprüften Aktion gesetzt — ein doppelt
-- abgesendetes Formular scheitert also weiterhin schon an der Elternzeile.
create or replace function public.enforce_completion_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if current_setting('cornice.completion_batch_write', true) = 'true' then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- save_free_ride_with_segments: legt eine freie Fahrt und 0..N automatisch
-- erkannte Streckenabschnitte atomar an.
--
-- Bewusst SECURITY INVOKER (kein "security definer", gleiches Muster wie
-- propose_route/propose_route_full, 0004/0006): läuft mit den Rechten des
-- aufrufenden Nutzers, RLS auf route_completions UND routes greift für
-- jede einzelne Anweisung unverändert. user_id kommt ausschliesslich aus
-- auth.uid(), nie aus einem Parameter — andernfalls liesse sich über ein
-- präpariertes JSON eine Fahrt im Namen eines fremden Nutzers anlegen.
--
-- Ohne erkannte Segmente (p_segments = '[]', der ganz überwiegende Fall)
-- verhält sich die Funktion exakt wie der bisherige Einzel-Insert in
-- logFreeRide — keine Verhaltensänderung für den bestehenden Weg.
create or replace function public.save_free_ride_with_segments(
  p_frei jsonb,
  p_segments jsonb default '[]'::jsonb
) returns table(out_id uuid, out_art text, out_route_id uuid)
language plpgsql
-- Pinnt nur die Namensauflösung für die ::geography-Casts unten (auf
-- Supabase-Projekten teils in "extensions" statt "public" installiert),
-- keine erhöhten Rechte — bleibt SECURITY INVOKER, RLS greift unverändert
-- für jede Zeile. Ohne das könnte "type geography does not exist"
-- auftreten, falls der ambiente search_path der aufrufenden Rolle
-- (authenticated) das PostGIS-Schema nicht enthält.
set search_path = public, extensions
as $$
declare
  v_parent_id uuid;
  v_segment jsonb;
  v_segment_route_id uuid;
  v_max_segments constant int := 20;
begin
  if jsonb_typeof(p_segments) is distinct from 'array' then
    raise exception 'p_segments must be a json array';
  end if;
  if jsonb_array_length(p_segments) > v_max_segments then
    raise exception 'too_many_segments';
  end if;

  insert into public.route_completions (
    user_id, art, route_id, fahrzeug_id, datum,
    distanz_km, dauer_sekunden, bewegte_zeit_sekunden,
    ist_oeffentlich, abdeckung_prozent,
    titel, notiz, start_ort, region,
    hoehenmeter_aufstieg, hoehenprofil,
    track, track_oeffentlich
  ) values (
    auth.uid(), 'frei', null, (p_frei->>'fahrzeug_id')::uuid, (p_frei->>'datum')::date,
    (p_frei->>'distanz_km')::numeric, (p_frei->>'dauer_sekunden')::integer,
    (p_frei->>'bewegte_zeit_sekunden')::integer,
    (p_frei->>'ist_oeffentlich')::boolean, null,
    nullif(p_frei->>'titel', ''), nullif(p_frei->>'notiz', ''),
    p_frei->>'start_ort', p_frei->>'region',
    (p_frei->>'hoehenmeter_aufstieg')::numeric, p_frei->'hoehenprofil',
    nullif(p_frei->>'track', '')::geography, nullif(p_frei->>'track_oeffentlich', '')::geography
  )
  returning route_completions.id into v_parent_id;

  out_id := v_parent_id;
  out_art := 'frei';
  out_route_id := null;
  return next;

  if jsonb_array_length(p_segments) = 0 then
    return;
  end if;

  -- Ab hier: Kindzeilen derselben, bereits gegen den Cooldown geprüften
  -- Aktion (siehe enforce_completion_cooldown oben).
  perform set_config('cornice.completion_batch_write', 'true', true);

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    v_segment_route_id := (v_segment->>'route_id')::uuid;

    -- Sichtbarkeitsprüfung nochmal hier, nicht nur in der aufrufenden
    -- TypeScript-Kandidatenauswahl (lib/routes.ts: listLoopRouteCandidates).
    -- RLS auf routes (status_ok/ist_privat, siehe 0049) würde eine fremde
    -- private oder nicht freigegebene Strecke ohnehin nicht liefern — diese
    -- Funktion läuft SECURITY INVOKER, RLS greift also bereits. Die
    -- Bedingung steht trotzdem explizit hier: falls ein direkter RPC-Aufruf
    -- (unter Umgehung der App) eine solche route_id unterschiebt, soll das
    -- lesbar als "route_not_eligible" scheitern statt sich implizit allein
    -- auf die Policy zu verlassen.
    if not exists (
      select 1 from public.routes r
      where r.id = v_segment_route_id
        and r.status_ok = true
        and (r.ist_privat = false or r.erstellt_von = auth.uid())
    ) then
      raise exception 'route_not_eligible';
    end if;

    insert into public.route_completions (
      user_id, art, route_id, fahrzeug_id, datum,
      distanz_km, dauer_sekunden, bewegte_zeit_sekunden,
      ist_oeffentlich, abdeckung_prozent,
      track, parent_completion_id, erkennung_automatisch
    ) values (
      auth.uid(), 'strecke', v_segment_route_id, (p_frei->>'fahrzeug_id')::uuid, (p_frei->>'datum')::date,
      (v_segment->>'distanz_km')::numeric, (v_segment->>'dauer_sekunden')::integer,
      (v_segment->>'bewegte_zeit_sekunden')::integer,
      false, (v_segment->>'abdeckung_prozent')::numeric,
      nullif(v_segment->>'track', '')::geography, v_parent_id, true
    )
    returning route_completions.id into out_id;

    out_art := 'strecke';
    out_route_id := v_segment_route_id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.save_free_ride_with_segments(jsonb, jsonb) from public;
grant execute on function public.save_free_ride_with_segments(jsonb, jsonb) to authenticated;

comment on function public.save_free_ride_with_segments(jsonb, jsonb) is
  'Legt eine freie Fahrt und ihre automatisch erkannten Streckenabschnitte (lib/lapDetection.ts) atomar an. SECURITY INVOKER — RLS greift für jede Zeile, user_id kommt ausschliesslich aus auth.uid(). Ohne erkannte Segmente identisch zum bisherigen Einzel-Insert in logFreeRide (lib/actions/completions.ts).';
