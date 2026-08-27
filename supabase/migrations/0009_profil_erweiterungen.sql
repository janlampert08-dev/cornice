-- Bündelt mehrere Erweiterungen in einer Migration:
--   1. Höhenprofil-Speicherung (schlankes Diagramm auf der Detailseite)
--   2. Moderator-Rolle + Policies zum Freischalten/Ablehnen von Vorschlägen
--   3. Öffentliche, aber auf das Nötigste reduzierte Foto-Galerie-View

-- 1. Höhenprofil ---------------------------------------------------------
alter table public.routes
  add column hoehenprofil jsonb;

comment on column public.routes.hoehenprofil is
  'Array von {km, m} (ca. 100 Punkte, geglättet) für das Höhenprofil-Diagramm.';

-- 2. Moderator-Rolle ------------------------------------------------------
alter table public.profiles
  add column is_moderator boolean not null default false;

create policy "Moderatoren sehen auch unveröffentlichte Strecken"
  on public.routes for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

create policy "Moderatoren können alle Strecken freischalten"
  on public.routes for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

create policy "Moderatoren können Strecken ablehnen (löschen)"
  on public.routes for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

-- 3. Foto-Galerie -----------------------------------------------------------
-- Bewusst ohne security_invoker: läuft mit den Rechten des View-Eigentümers,
-- damit auch Fotos anderer Nutzer sichtbar werden (route_completions selbst
-- bleibt privat — RLS erlaubt dort weiterhin nur den Zugriff auf eigene
-- Zeilen). Es werden nur Bild-URL, Datum und Anzeigename exponiert, keine
-- weiteren privaten Felder (kein dauer_sekunden, kein fahrzeug_id).
create view public.route_photos as
select
  rc.id,
  rc.route_id,
  rc.foto_url,
  rc.datum,
  p.display_name
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
where rc.foto_url is not null;

grant select on public.route_photos to anon, authenticated;

-- routes_geojson-View um hoehenprofil ergänzen.
drop view if exists public.routes_geojson;

create view public.routes_geojson
with (security_invoker = true) as
select
  id,
  name,
  region,
  start_ort,
  ziel_ort,
  ST_AsGeoJSON(start_coord)::json as start_geojson,
  ST_AsGeoJSON(ziel_coord)::json as ziel_geojson,
  ST_AsGeoJSON(geometry)::json as geometry_geojson,
  hoehe_m,
  laenge_km,
  max_steigung_prozent,
  kehren,
  kategorien,
  saison_status,
  status_ok,
  charakter_text,
  tempolimits,
  hoehenprofil,
  ST_DWithin(start_coord, ziel_coord, 500) as ist_rundfahrt,
  erstellt_von,
  created_at
from public.routes;
