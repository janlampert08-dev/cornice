-- Optionale, rein private Zeit-/Distanzerfassung pro Fahrt. Bewusst KEIN
-- Vergleich zwischen Nutzern (keine Bestenliste, keine Segmente) — nur der
-- fahrende Nutzer selbst sieht seine Zeiten (RLS auf route_completions
-- erlaubt ohnehin nur select der eigenen Zeilen, siehe 0001_init.sql).
-- Timer ist im UI ein bewusstes Opt-in mit Warnhinweis, siehe
-- components/LiveTrackingForm.tsx.
alter table public.route_completions
  add column dauer_sekunden integer,
  add column distanz_km numeric;

comment on column public.route_completions.dauer_sekunden is
  'Optional, nur gesetzt wenn der Nutzer den Timer aktiv eingeschaltet hat. Rein privat, kein Vergleich zwischen Nutzern.';
comment on column public.route_completions.distanz_km is
  'Tatsächlich per Browser-GPS getrackte Distanz dieser Fahrt (kann von der offiziellen Streckenlänge abweichen).';
