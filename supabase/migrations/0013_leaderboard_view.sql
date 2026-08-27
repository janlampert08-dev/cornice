-- Aggregiert öffentliche, NICHT-zeitbezogene Fahrdaten für die globalen
-- Bestenlisten (meiste Pässe / Höhenmeter / km). Bewusst ohne
-- dauer_sekunden/fahrzeug_id — die Zeitmessung bleibt privat (siehe
-- 0008_tracking.sql: "kein Vergleich zwischen Nutzern" gilt weiterhin für
-- Zeiten, nicht für das blosse "diese Strecke gefahren").
--
-- Wie route_photos (0009_profil_erweiterungen.sql) bewusst OHNE
-- security_invoker: route_completions selbst bleibt per RLS privat
-- (nur eigene Zeilen sichtbar), aber dieser View läuft mit den Rechten
-- des Eigentümers und aggregiert dadurch auch Fahrten anderer Nutzer.
create view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where r.status_ok = true;

grant select on public.leaderboard_completions to anon, authenticated;
