-- Produktentscheid-Revision zu 0044_freie_fahrten.sql: freie Fahrten
-- zaehlen ab jetzt in den globalen Bestenlisten mit (meiste Fahrten, meiste
-- km, meiste Hoehenmeter). 0044 hatte das bewusst ausgeschlossen, weil eine
-- freie Fahrt keinen Deckungsgrad als Echtheitsanker hat ("meiste Km waere
-- sonst mit dem Arbeitsweg gewinnbar") -- dieses Risiko wird mit dieser
-- Migration bewusst in Kauf genommen (siehe PR-Beschreibung).
--
-- "Meiste Strecken" (Entdecker, strecken_count in leaderboard_user_totals)
-- bleibt unveraendert streckenbasiert: count(distinct route_id) ignoriert
-- NULL von selbst, freie Fahrten (route_id is null) tragen dort also
-- weiterhin nichts bei -- ohne eigenen Filter noetig.
--
-- leaderboard_user_totals (0054_leaderboard_user_totals.sql) haengt per
-- SELECT-Spaltenliste an leaderboard_completions und muss deshalb mit
-- neu erstellt werden: CREATE OR REPLACE VIEW erlaubt kein Umbenennen
-- bestehender Spalten (hoehe_m -> hoehenmeter_aufstieg), nur Anhaengen ans
-- Ende. Beide Views werden hier daher explizit gedroppt und neu angelegt,
-- inklusive ihrer Grants (die ein DROP nicht ueberlebt).
drop view if exists public.leaderboard_user_totals;
drop view if exists public.leaderboard_completions;

create view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  -- Vorher r.hoehe_m (Scheitelhoehe der Strecke) -- freie Fahrten haben
  -- keine Strecke und damit kein hoehe_m. Um beide Fahrtarten in einer
  -- Summe vergleichbar zu machen, zaehlt die Bestenliste ab jetzt fuer
  -- BEIDE Arten rc.hoehenmeter_aufstieg (kumulierter Anstieg aus dem
  -- GPS-Track, siehe 0044_freie_fahrten.sql). Fuer Streckenfahrten wird
  -- dieser Wert ab jetzt ebenfalls berechnet (lib/actions/completions.ts,
  -- logTrackedCompletion) -- bereits bestehende Streckenfahrten haben ihn
  -- nicht rueckwirkend gesetzt und tragen bis zu einer erneuten Fahrt oder
  -- einem separaten Backfill 0 Hoehenmeter bei.
  rc.hoehenmeter_aufstieg,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from route_completions rc
  join profiles p on (p.id = rc.user_id)
  -- LEFT JOIN statt INNER: freie Fahrten haben route_id is null und damit
  -- keine passende Zeile in routes. Die Kopplung an r.status_ok bleibt fuer
  -- Streckenfahrten bestehen, genau wie bei public_fahrten (0045) muss der
  -- Filter unten deshalb ausdruecklich nach art unterscheiden statt sich
  -- auf ein implizites "r.id is null" zu verlassen.
  left join routes r on (r.id = rc.route_id)
where rc.ist_oeffentlich = true
  and (
    (rc.art = 'strecke' and r.status_ok = true)
    or (rc.art = 'frei' and rc.route_id is null)
  );

grant select on public.leaderboard_completions to anon, authenticated;

comment on view public.leaderboard_completions is
  'Aggregierte oeffentliche Fahrdaten fuer die globalen Bestenlisten (meiste Fahrten/km/Hoehenmeter/Strecken). Seit 0056 zaehlen freie Fahrten mit (vorher 0044: streckenbasiert). hoehenmeter_aufstieg (kumulierter Anstieg) ersetzt fuer beide Fahrtarten die vorherige Scheitelhoehe-basierte Zahl.';

-- Unveraendert gegenueber 0054_leaderboard_user_totals.sql bis auf
-- sum(hoehe_m) -> sum(hoehenmeter_aufstieg), der neuen Spalte oben folgend.
create view public.leaderboard_user_totals as
select
  user_id,
  display_name,
  avatar_url,
  ist_premium,
  zeigt_premium_badge,
  count(*) as fahrten_count,
  coalesce(sum(hoehenmeter_aufstieg), 0) as hoehenmeter,
  coalesce(sum(effektive_distanz_km), 0) as km,
  count(distinct route_id) as strecken_count
from public.leaderboard_completions
group by user_id, display_name, avatar_url, ist_premium, zeigt_premium_badge;

grant select on public.leaderboard_user_totals to anon, authenticated;

comment on view public.leaderboard_user_totals is
  'Pro-Nutzer-Aggregat von leaderboard_completions fuer die globalen Bestenlisten (app/leaderboards) -- eine Zeile pro Nutzer statt pro Fahrt. Laeuft wie leaderboard_completions mit den Rechten des View-Owners, siehe 0013_leaderboard_view.sql. Seit 0056 zaehlen freie Fahrten in fahrten_count/hoehenmeter/km mit; strecken_count bleibt ueber count(distinct route_id) streckenbasiert.';
