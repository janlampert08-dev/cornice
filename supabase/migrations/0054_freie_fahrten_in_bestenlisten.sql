-- Produktentscheid-Revision zu 0044_freie_fahrten.sql: freie Fahrten
-- zaehlen ab jetzt in den globalen Bestenlisten mit (meiste Fahrten, meiste
-- km, meiste Hoehenmeter). 0044 hatte das bewusst ausgeschlossen, weil eine
-- freie Fahrt keinen Deckungsgrad als Echtheitsanker hat ("meiste Km waere
-- sonst mit dem Arbeitsweg gewinnbar") -- dieses Risiko wird mit dieser
-- Migration bewusst in Kauf genommen (siehe PR-Beschreibung).
--
-- "Meiste Strecken" (Entdecker) bleibt unveraendert streckenbasiert: eine
-- freie Fahrt hat keine route_id und traegt dort nichts bei. Das wird in
-- lib/leaderboard.ts gefiltert, nicht hier -- route_id bleibt in dieser
-- View einfach nullable.
create or replace view public.leaderboard_completions as
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

comment on view public.leaderboard_completions is
  'Aggregierte oeffentliche Fahrdaten fuer die globalen Bestenlisten (meiste Fahrten/km/Hoehenmeter/Strecken). Seit 0054 zaehlen freie Fahrten mit (vorher 0044: streckenbasiert). hoehenmeter_aufstieg (kumulierter Anstieg) ersetzt fuer beide Fahrtarten die vorherige Scheitelhoehe-basierte Zahl.';
