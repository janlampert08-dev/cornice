-- Schutz gegen abgekürzte Fahrten oder falsche Start-/Endpunkte: der Client
-- berechnet beim Speichern einen Deckungsgrad (wie viel % der offiziellen
-- Streckengeometrie durch aufgezeichnete GPS-Punkte abgedeckt ist, siehe
-- lib/routeCoverage.ts) und schickt ihn mit. Bestehende Fahrten (vor diesem
-- Feature aufgezeichnet, kein Trail gespeichert) gelten als voll abgedeckt —
-- rückwirkend nicht prüfbar, sollen aber nicht plötzlich als verdächtig gelten.
alter table public.route_completions
  add column abdeckung_prozent numeric not null default 100 check (
    abdeckung_prozent >= 0 and abdeckung_prozent <= 100
  );

comment on column public.route_completions.abdeckung_prozent is
  'Client-berechneter Deckungsgrad (0-100) der GPS-Aufzeichnung ggü. der offiziellen Streckengeometrie. Unterhalb des Schwellenwerts (COVERAGE_THRESHOLD_PERCENT, lib/routeCoverage.ts) kann eine Fahrt nicht öffentlich markiert werden — server-seitig in lib/actions/completions.ts erzwungen, nicht nur im UI.';
