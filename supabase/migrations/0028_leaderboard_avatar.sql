-- Avatar in den öffentlichen, RLS-umgehenden Bestenlisten-Views verfügbar
-- machen — angehängt (nicht zwischen bestehende Spalten eingefügt), damit
-- CREATE OR REPLACE VIEW nicht an der bestehenden Spaltenreihenfolge
-- scheitert (siehe 0021_premium_und_private_strecken.sql für dasselbe
-- Vorgehen).
--
-- Wie schon bei ist_premium (0027_security_performance_hardening.sql,
-- Abschnitt F1) wird der Wert NICHT roh nach aussen gegeben, sondern
-- serverseitig bereits mit dem zeigt_avatar-Opt-in (0015_profil_sichtbarkeit_
-- avatar.sql, Standard: false) verrechnet ausgegeben. Diese beiden Views
-- laufen bewusst mit den Rechten des View-Owners (bypassen RLS auf
-- route_completions/profiles) — ohne serverseitiges Gaten würde jeder
-- Aufrufer dieser Views den Avatar einer Person sehen, selbst wenn diese ihn
-- bewusst nicht öffentlich zeigen möchte. Zusätzlich zum bestehenden
-- ist_oeffentlich-Filter (entscheidet, ob eine Fahrt überhaupt erscheint) —
-- beide Opt-ins sind unabhängig voneinander: jemand kann eine Fahrt teilen,
-- ohne dabei automatisch sein Profilbild preiszugeben.
create or replace view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from route_completions rc
  join profiles p on (p.id = rc.user_id)
  join routes r on (r.id = rc.route_id)
where r.status_ok = true and rc.ist_oeffentlich = true;

comment on view public.leaderboard_completions is
  'Öffentliches Leaderboard-Aggregat, läuft bewusst mit den Rechten des View-Owners (bypasst RLS auf route_completions/profiles) — das ist der Zweck dieser View, siehe 0013_leaderboard_view.sql. ist_premium ist bereits mit zeigt_premium_badge verrechnet (0027), avatar_url ist ab 0028 ebenso bereits mit dem zeigt_avatar-Opt-in verrechnet ausgegeben, damit ein direkter PostgREST-Request nicht den Avatar/Premium-Status einer Person offenlegt, die das nicht öffentlich zeigen möchte.';

create or replace view public.route_leaderboard as
select
  rc.id as completion_id,
  rc.route_id,
  rc.user_id,
  p.display_name,
  rc.dauer_sekunden,
  rc.distanz_km,
  rc.datum,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from route_completions rc
  join profiles p on (p.id = rc.user_id)
where rc.ist_oeffentlich = true and rc.dauer_sekunden is not null;

comment on view public.route_leaderboard is
  'Pro-Strecke-Leaderboard, läuft bewusst mit den Rechten des View-Owners (bypasst RLS), siehe 0014_route_leaderboard_optin.sql. avatar_url ist wie bei leaderboard_completions bereits mit dem zeigt_avatar-Opt-in verrechnet ausgegeben.';
