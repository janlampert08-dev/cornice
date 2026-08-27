-- Vereinfacht das Sichtbarkeits-Modell auf eine einzige Einstellung: die
-- separate Pro-Fahrt-Freigabe (auf_leaderboard, 0014) entfällt zugunsten der
-- Profileinstellung "Gefahrene Strecken zeigen" (zeigt_fahrten, 0015) — wer
-- diese aktiviert hat, erscheint automatisch auf allen Strecken-Bestenlisten,
-- für die er eine Zeit erfasst hat. Kein zweiter Schalter pro Fahrt mehr.
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
where p.zeigt_fahrten = true and rc.dauer_sekunden is not null;
