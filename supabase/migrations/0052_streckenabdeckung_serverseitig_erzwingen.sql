-- CWE-602 (Client-Side Enforcement of Server-Side Security), aus dem
-- CodeRabbit-Review von PR #82 zurückgestellt und hier nachgeholt: der
-- Deckungsgrad-Schwellenwert (COVERAGE_THRESHOLD_PERCENT, lib/routeCoverage.ts)
-- wird bisher ausschliesslich in TypeScript geprüft (lib/actions/completions.ts).
-- RLS auf route_completions ("Nutzer verwalten eigene Fahrten", 0001_init.sql)
-- prüft nur auf auth.uid() = user_id — nicht, ob abdeckung_prozent/
-- ist_oeffentlich zum tatsächlich gespeicherten track passen. Wer direkt per
-- PostgREST insertiert oder updated (unter Umgehung der Next.js Server
-- Actions und der RPC-Funktion save_free_ride_with_segments, 0050), könnte
-- also z.B. abdeckung_prozent = 100 für einen Track mitschicken, der die
-- Strecke nie berührt hat.
--
-- Diese Migration schliesst die Lücke unabhängig vom Insert-Pfad: ein
-- BEFORE-INSERT-OR-UPDATE-Trigger berechnet abdeckung_prozent bei jeder
-- Streckenfahrt (art = 'strecke') serverseitig aus dem gespeicherten track
-- gegen die offizielle Streckengeometrie neu — der vom Client mitgeschickte
-- Wert wird dabei vollständig verworfen, genau wie es lib/actions/
-- completions.ts für den App-Pfad bereits tut (siehe dortige Kommentare
-- "distanz_km/dauer_sekunden/abdeckung_prozent kommen NICHT vom Client").
--
-- Bewusst NICHT rückwirkend: bestehende Zeilen werden nicht neu berechnet.
-- Das wäre eine eigene, riskantere Änderung (könnte legitime, historisch
-- eingetragene Fahrten aufgrund kleiner algorithmischer Abweichungen
-- rückwirkend als "nicht mehr öffentlich" umklassieren) und gehört nicht in
-- diese Migration — hier geht es um die Durchsetzung ab jetzt.

-- ---------------------------------------------------------------------------
-- A) compute_route_coverage_percent: Portierung von computeRouteCoverage
--    (lib/routeCoverage.ts) nach PostGIS.
--
--    Statt diskreter Trail-Punkte alle SAMPLE_INTERVAL_KM entlang der
--    Streckengeometrie zu prüfen, tastet diese Fassung die Strecke per
--    ST_LineInterpolatePoint in gleichmässigen 100m-Schritten ab und prüft
--    per ST_DWithin gegen die gespeicherte, vereinfachte track-Geometrie
--    (Douglas-Peucker-Toleranz TRACK_SIMPLIFY_TOLERANCE_M = 5m, siehe
--    lib/track.ts) statt gegen den rohen Trail. Beide Abweichungen von der
--    TypeScript-Fassung sind unkritisch: der Korridor (80m) liegt eine
--    Grössenordnung über der Vereinfachungstoleranz (5m) — eine Strecke, die
--    im TS-Sinn "abgedeckt" ist, ist es nach dieser Berechnung praktisch
--    immer auch, und umgekehrt. Diese Funktion ist ein serverseitiger
--    Anti-Fälschungs-Backstop, kein Ersatz für die App-seitige Berechnung
--    (die bleibt für sofortiges UI-Feedback im Fazit-Screen bestehen).
--
--    CORRIDOR_M (80) und SAMPLE_INTERVAL_M (100) entsprechen CORRIDOR_KM/
--    SAMPLE_INTERVAL_KM in lib/routeCoverage.ts — hier hart kodiert, da es
--    keinen Mechanismus gibt, eine Konstante zwischen TypeScript und SQL zu
--    teilen. Ändert sich einer der beiden TS-Werte, muss diese Funktion von
--    Hand nachgezogen werden (neue Migration, siehe Core Rule 9).
--
--    Die Sample-Anzahl ist zusätzlich auf 5000 gedeckelt (bei 100m-Schritten
--    eine 500km-Strecke) — reine Vorsicht gegen eine pathologisch lange
--    Streckengeometrie, die den Trigger unnötig teuer machen würde. Wichtig:
--    die Deckelung reduziert nur die Auflösung (grösserer Punktabstand),
--    NICHT die abgetastete Streckenlänge — der Bruchteilsbereich [0,1] wird
--    immer vollständig abgedeckt (n / sample_count unten, nicht n * 100m).
--    Eine fixe 100m-Schrittweite, die bei sample_count einfach abgebrochen
--    hätte (ursprüngliche Fassung dieser Migration, per CodeRabbit-Review
--    dieser PR gefunden), hätte bei einer > 500km-Strecke das hintere
--    Streckenstück nie geprüft — ein Track, der nur den Anfang abdeckt,
--    wäre fälschlich als 100% durchgegangen.
-- ---------------------------------------------------------------------------
create or replace function public.compute_route_coverage_percent(
  p_route_geometry geography,
  p_track geography
) returns numeric
language sql
stable
set search_path = public, extensions
as $$
  with route as (
    select
      p_route_geometry::geometry as geom,
      -- Explizit auf double precision festgenagelt (ST_Length liefert das
      -- ohnehin): erspart der Fraktionsberechnung unten jede numeric/float8-
      -- Mischarithmetik, deren implizite Cast-Auflösung sonst vom Zufall
      -- der jeweiligen Postgres-Version abhinge.
      ST_Length(p_route_geometry)::double precision as length_m
  ),
  bounded as (
    select
      geom,
      length_m,
      -- >= 1 garantiert (length_m > 0 unten => ceil(...) >= 1), greatest()
      -- nur als explizite zweite Absicherung gegen eine Division durch 0.
      greatest(least(ceil(length_m / 100::double precision)::int, 5000), 1) as sample_count
    from route
    where length_m > 0
  ),
  samples as (
    select
      ST_LineInterpolatePoint(
        bounded.geom,
        n::double precision / bounded.sample_count::double precision
      )::geography as sample_point
    from bounded, generate_series(0, bounded.sample_count) as n
  )
  select case
    when p_track is null or (select count(*) from samples) = 0 then 0
    else round(
      100.0 * count(*) filter (where ST_DWithin(sample_point, p_track, 80)) / count(*)
    )
  end
  from samples;
$$;

comment on function public.compute_route_coverage_percent(geography, geography) is
  'PostGIS-Portierung von computeRouteCoverage (lib/routeCoverage.ts): Anteil der Streckengeometrie (100m-Schritte), der innerhalb von 80m eines Tracks liegt. Reiner Anti-Fälschungs-Backstop für enforce_route_completion_coverage() unten, nicht für direkten RPC-Aufruf gedacht.';

-- Nur vom Trigger unten verwendet (läuft als Invoker, siehe dort) — kein
-- eigener öffentlicher RPC-Endpunkt. revoke ... from public entzieht den
-- automatischen Grant; da diese Funktion aus dem SECURITY-INVOKER-Trigger
-- heraus als "authenticated" läuft (der normale App-Pfad), braucht
-- authenticated weiterhin EXECUTE — sonst schlägt jede Streckenfahrt fehl.
-- anon erreicht route_completions ohnehin nie (RLS), bekommt hier aber
-- trotzdem explizit keinen direkten Grant (0048-Lehre: ein revoke gegen
-- PUBLIC wirkt nicht gegen einen direkten ALTER-DEFAULT-PRIVILEGES-Grant).
revoke execute on function public.compute_route_coverage_percent(geography, geography) from public;
revoke execute on function public.compute_route_coverage_percent(geography, geography) from anon;
grant execute on function public.compute_route_coverage_percent(geography, geography) to authenticated;

-- ---------------------------------------------------------------------------
-- B) enforce_route_completion_coverage: Trigger, der abdeckung_prozent und
--    ist_oeffentlich bei jeder Streckenfahrt serverseitig durchsetzt.
--
--    Bewusst KEIN "security definer": läuft mit den Rechten des Aufrufers,
--    damit die Sichtbarkeitsregel für routes (RLS: status_ok = true oder
--    erstellt_von = auth.uid(), 0001/0049) auch hier greift. Zeigt route_id
--    auf eine Strecke, die der Aufrufer nicht sehen darf (privat, fremd,
--    nicht freigegeben), liefert die SELECT unten keine Zeile — die Fahrt
--    wird mit demselben Fehlertext abgelehnt, den save_free_ride_with_segments
--    (0050) für denselben Fall verwendet.
--
--    Fallunterscheidung für new.track:
--      1. new.track IS NOT NULL: immer neu berechnen und den Client-Wert
--         überschreiben. Das ist der Normalfall (jede Streckenfahrt aus
--         logTrackedCompletion/buildDetectedSegments) UND schliesst zugleich
--         den direkten PostgREST-Bypass (z.B. PATCH .../route_completions
--         mit {"abdeckung_prozent": 100}, ohne track zu ändern — new.track
--         bleibt dabei gleich old.track, wird also unverändert neu geprüft).
--      2. new.track IS NULL bei INSERT: keine Geometrie zum Verifizieren da
--         — kann nie öffentlich/gedeckt sein, unabhängig vom Client-Wert.
--      3. new.track IS NULL bei UPDATE, und abdeckung_prozent/ist_oeffentlich
--         ändern sich dabei tatsächlich: derselbe Fall wie 2 (kein Track,
--         der die neuen Werte stützen könnte) — auf sicher zurückgesetzt.
--      4. new.track IS NULL bei UPDATE, und weder abdeckung_prozent noch
--         ist_oeffentlich ändern sich: nichts zu validieren, unverändert
--         durchlassen. Der einzige Fall dafür in dieser Codebase ist
--         anonymize_own_account() (0021/0045): die setzt track = null,
--         lässt ist_oeffentlich für art = 'strecke' aber ausdrücklich
--         unverändert ("Streckenfahrten bleiben öffentlich", 0045) und
--         fasst abdeckung_prozent gar nicht an. Ohne diesen vierten Fall
--         würde diese Migration genau diese in 0045 explizit begründete
--         Geschäftsregel unbeabsichtigt aufweichen.
--
--    Bekannte, bewusst in Kauf genommene Nebenwirkung von Fall 3: wird eine
--    Fahrt, deren track bereits (durch Kontolöschung) entfernt wurde, später
--    per toggleCompletionVisibility wieder umgeschaltet, ändert sich dabei
--    ist_oeffentlich zwangsläufig (der Toggle liest den alten Wert und kehrt
--    ihn um) — sie fällt dann unter Fall 3 und wird auf privat/0% zurück-
--    gesetzt. Eine Fahrt ohne Geometrie lässt sich nicht mehr neu verifizieren
--    und bleibt damit korrekterweise nicht erneut veröffentlichbar.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_route_completion_coverage()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_route_geometry geography;
  v_coverage numeric;
begin
  if new.art <> 'strecke' then
    return new;
  end if;

  select geometry into v_route_geometry
  from public.routes
  where id = new.route_id;

  if v_route_geometry is null then
    raise exception 'route_not_eligible';
  end if;

  if new.track is not null then
    v_coverage := public.compute_route_coverage_percent(v_route_geometry, new.track);
    new.abdeckung_prozent := v_coverage;
    new.ist_oeffentlich := new.ist_oeffentlich and v_coverage >= 75;
  elsif tg_op = 'INSERT' then
    new.abdeckung_prozent := 0;
    new.ist_oeffentlich := false;
  elsif new.abdeckung_prozent is distinct from old.abdeckung_prozent
     or new.ist_oeffentlich is distinct from old.ist_oeffentlich then
    new.abdeckung_prozent := 0;
    new.ist_oeffentlich := false;
  end if;

  return new;
end;
$$;

comment on function public.enforce_route_completion_coverage() is
  'Erzwingt abdeckung_prozent/ist_oeffentlich serverseitig für jede Streckenfahrt (art = ''strecke''), unabhängig vom Insert-/Update-Pfad — siehe compute_route_coverage_percent() oben. CWE-602-Backstop, Nachtrag zu PR #82.';

-- Reine Trigger-Funktion: feuert unabhängig von EXECUTE-Rechten (siehe
-- 0047, Abschnitt A) — der Entzug schliesst nur den unnötigen direkten
-- RPC-Aufrufweg.
revoke execute on function public.enforce_route_completion_coverage() from public;
revoke execute on function public.enforce_route_completion_coverage() from anon, authenticated;

create trigger route_completions_recompute_coverage
  before insert or update on public.route_completions
  for each row
  execute function public.enforce_route_completion_coverage();
