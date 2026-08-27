-- View mit GeoJSON-Repräsentation der geography-Spalten, damit der Client
-- (Mapbox GL) die Geometrie direkt verwenden kann, ohne WKB selbst zu parsen.
-- security_invoker sorgt dafür, dass die RLS-Policies von public.routes
-- weiterhin greifen (View läuft mit den Rechten des abfragenden Nutzers).
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
  erstellt_von,
  created_at
from public.routes;
