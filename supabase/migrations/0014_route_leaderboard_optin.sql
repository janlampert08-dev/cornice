-- Opt-in-Freigabe für ein Streckenleaderboard mit Bestzeiten. Ersetzt NICHT
-- die bestehende Privatsphäre-Garantie für Zeiten (0008_tracking.sql) — eine
-- Fahrt wird nur dann für andere sichtbar, wenn der Fahrer sie explizit
-- dafür freigibt (Checkbox beim Speichern, oder nachträglich im Profil).
-- route_completions selbst bleibt weiterhin per RLS privat.
alter table public.route_completions
  add column auf_leaderboard boolean not null default false;

comment on column public.route_completions.auf_leaderboard is
  'Opt-in: true nur wenn der Nutzer diese konkrete Fahrt fürs Strecken-Leaderboard freigegeben hat. Ohne dauer_sekunden wirkungslos.';

-- Wie route_photos (0009_profil_erweiterungen.sql): bewusst OHNE
-- security_invoker, damit auch freigegebene Zeiten anderer Nutzer sichtbar
-- werden. Zeigt ausschliesslich Fahrten mit aktivem Opt-in UND erfasster
-- Zeit — alles andere bleibt über die normale RLS-Policy privat.
create view public.route_leaderboard as
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
where rc.auf_leaderboard = true and rc.dauer_sekunden is not null;

grant select on public.route_leaderboard to anon, authenticated;
