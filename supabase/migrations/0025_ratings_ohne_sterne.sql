-- Entfernt die Sterne-Bewertung — Nutzer sollen nur noch kommentieren
-- können, keine 1-5-Sterne-Bewertung mehr abgeben. Spalte bleibt (nullable)
-- statt gelöscht zu werden, damit bereits vergebene Sterne nicht verloren
-- gehen, falls sie später doch noch ausgewertet werden sollen — die App
-- schreibt und liest sie schlicht nicht mehr.
alter table public.route_ratings
  alter column sterne drop not null;

alter table public.route_ratings
  drop constraint if exists route_ratings_sterne_check;
