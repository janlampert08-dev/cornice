-- Ersetzt die globale Profileinstellung "Gefahrene Strecken zeigen"
-- (zeigt_fahrten, 0015/0016) durch eine Sichtbarkeit PRO FAHRT: der Nutzer
-- entscheidet im Fazit-Screen beim Speichern einer getrackten Fahrt (und kann
-- es danach jederzeit im Profil per Symbol umschalten), ob GENAU DIESE Fahrt
-- öffentlich (Bestenlisten, öffentliches Profil) oder privat ist.
-- Reaktiviert dafür die Pro-Fahrt-Spalte aus 0014 (seit 0016 ungenutzt) unter
-- klarerem Namen, statt eine weitere Spalte anzulegen — bestehende Werte
-- (aus der kurzlebigen 0014-Variante) bleiben dabei erhalten.
alter table public.route_completions
  rename column auf_leaderboard to ist_oeffentlich;

comment on column public.route_completions.ist_oeffentlich is
  'Opt-in pro Fahrt: true wenn diese Fahrt auf Bestenlisten und dem öffentlichen Profil sichtbar sein soll. Ersetzt profiles.zeigt_fahrten (0015/0016).';

create or replace view public.route_leaderboard as
select
  rc.id as completion_id,
  rc.route_id,
  rc.user_id,
  p.display_name,
  rc.dauer_sekunden,
  rc.distanz_km,
  rc.datum
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
where rc.ist_oeffentlich = true and rc.dauer_sekunden is not null;

create or replace view public.leaderboard_completions as
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
where r.status_ok = true and rc.ist_oeffentlich = true;

create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;

-- "Gefahrene Strecken zeigen" ist jetzt pro Fahrt entscheidbar — die globale
-- Einstellung entfällt. zeigt_fahrzeuge bleibt (unabhängige Einstellung).
alter table public.profiles drop column zeigt_fahrten;
