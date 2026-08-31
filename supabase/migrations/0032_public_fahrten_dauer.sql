-- public_fahrten (0017/0018/0029/0030) um dauer_sekunden erweitert — für
-- die neue Fahrt-Detailseite (app/fahrten/[id]/page.tsx, Strava-artige
-- "custom subpage" pro Aufzeichnung mit Strecke, Stats und Kudos). Keine
-- neue Datenfreigabe: dauer_sekunden öffentlicher Fahrten wird bereits seit
-- 0017 über route_leaderboard/leaderboard_completions offengelegt — hier
-- nur dieselbe, bereits als "bei ist_oeffentlich=true fair game" etablierte
-- Spalte zusätzlich über public_fahrten verfügbar, als letzte Spalte
-- angehängt (CREATE OR REPLACE VIEW erlaubt keine Umsortierung
-- bestehender Spalten).
create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum,
  rc.distanz_km,
  rc.id as completion_id,
  p.display_name,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url,
  rc.dauer_sekunden
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;
