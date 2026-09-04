-- Aggregierte Fassung von leaderboard_completions: eine Zeile pro Nutzer
-- statt pro Fahrt. getGlobalLeaderboards() (lib/leaderboard.ts) lud bisher
-- select("*") auf leaderboard_completions — eine Zeile pro öffentlich
-- geteilter Streckenfahrt der GESAMTEN Plattform — und summierte
-- anschliessend in JS zu vier Bestenlisten. Das wächst mit der Fahrtenzahl,
-- nicht mit der (viel langsamer wachsenden) Nutzerzahl, und überträgt bei
-- jedem Aufruf der Bestenlisten-Seite die komplette Fahrtenhistorie über den
-- Wire, nur um daraus die Top 3 pro Kategorie zu bilden.
--
-- Diese View übernimmt die Summierung serverseitig; lib/leaderboard.ts
-- fragt sie ab jetzt viermal mit je eigenem "order by ... limit 3" ab,
-- statt einmal alles zu laden und erst im Code zu sortieren.
--
-- Läuft wie leaderboard_completions selbst mit den Rechten des View-Owners
-- (siehe 0013_leaderboard_view.sql/0028_leaderboard_avatar.sql) — kein
-- zusätzlicher RLS-Bypass, nur eine Aggregation über eine bereits
-- öffentliche, bereits mit den Sichtbarkeits-Opt-ins (zeigt_avatar,
-- zeigt_premium_badge) verrechnete View.
--
-- display_name/avatar_url/ist_premium/zeigt_premium_badge stehen pro
-- user_id fest (kommen 1:1 aus profiles), müssen aber trotzdem mit in die
-- GROUP BY: Postgres kann diese funktionale Abhängigkeit über eine View
-- hinweg nicht selbst ableiten (anders als bei einer Tabelle mit
-- deklariertem Primary Key).
--
-- coalesce(..., 0) auf hoehenmeter/km entspricht der bisherigen JS-Logik
-- (row.hoehe_m ?? 0 / row.effektive_distanz_km ?? 0 vor der Summierung) —
-- ein Nutzer, dessen Strecken durchweg kein hoehe_m tragen, soll weiterhin
-- als 0 statt als NULL erscheinen.
create view public.leaderboard_user_totals as
select
  user_id,
  display_name,
  avatar_url,
  ist_premium,
  zeigt_premium_badge,
  count(*) as fahrten_count,
  coalesce(sum(hoehe_m), 0) as hoehenmeter,
  coalesce(sum(effektive_distanz_km), 0) as km,
  count(distinct route_id) as strecken_count
from public.leaderboard_completions
group by user_id, display_name, avatar_url, ist_premium, zeigt_premium_badge;

grant select on public.leaderboard_user_totals to anon, authenticated;

comment on view public.leaderboard_user_totals is
  'Pro-Nutzer-Aggregat von leaderboard_completions für die globalen Bestenlisten (app/leaderboards) — eine Zeile pro Nutzer statt pro Fahrt, damit getGlobalLeaderboards() nur noch vier kleine "order by ... limit"-Abfragen statt der kompletten Fahrtenhistorie lädt. Läuft wie leaderboard_completions mit den Rechten des View-Owners, siehe 0013_leaderboard_view.sql.';
