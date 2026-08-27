-- Tempolimit-Segmente je Strecke (aus OSM "maxspeed" bzw. Mapbox-Directions-
-- Annotations) + erkannte Rundfahrten (Start ≈ Ziel).

alter table public.routes
  add column tempolimits jsonb;

comment on column public.routes.tempolimits is
  'Array von {km_von, km_bis, kmh, bekannt} entlang der Strecke, sortiert nach km_von.';

-- View ersetzen (add column erfordert kein drop, aber neue Felder sollen
-- im GeoJSON-View mitgeliefert werden).
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
  ST_DWithin(start_coord, ziel_coord, 500) as ist_rundfahrt,
  erstellt_von,
  created_at
from public.routes;
