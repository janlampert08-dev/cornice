-- Optionale, kurze persönliche Notiz zu einer getrackten Fahrt (z.B. "nasse
-- Fahrbahn nach Bivio", "mit der Ducati"). Rein privat wie dauer_sekunden/
-- distanz_km — kein Feld in public_fahrten, RLS auf route_completions
-- erlaubt ohnehin nur select der eigenen Zeilen (0001_init.sql).
alter table public.route_completions
  add column notiz text;

alter table public.route_completions
  add constraint route_completions_notiz_length check (
    notiz is null or char_length(notiz) <= 280
  );

comment on column public.route_completions.notiz is
  'Optionale persönliche Notiz zur Fahrt, max. 280 Zeichen. Rein privat.';
