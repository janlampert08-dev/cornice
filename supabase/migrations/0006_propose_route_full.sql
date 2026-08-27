-- Ersetzt die reine Luftlinie aus propose_route: der Client ermittelt die
-- Geometrie jetzt vorab über Mapbox Directions (echtes Strassenrouting,
-- inkl. Tempolimit-Annotationen) und übergibt sie fertig als GeoJSON.
-- Läuft weiterhin mit den Rechten des aufrufenden Nutzers (kein
-- "security definer"), die RLS-Policies auf public.routes greifen also
-- unverändert.
create or replace function public.propose_route_full(
  p_name text,
  p_region text,
  p_start_ort text,
  p_ziel_ort text,
  p_geometry_geojson jsonb,
  p_laenge_km numeric,
  p_kategorien text[],
  p_charakter_text text,
  p_tempolimits jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_geom geometry;
begin
  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson::text), 4326);

  insert into public.routes (
    name, region, start_ort, ziel_ort,
    start_coord, ziel_coord, geometry,
    laenge_km, kategorien, saison_status, status_ok, charakter_text,
    tempolimits, erstellt_von
  ) values (
    p_name, p_region, p_start_ort, p_ziel_ort,
    ST_StartPoint(v_geom)::geography,
    ST_EndPoint(v_geom)::geography,
    v_geom::geography,
    p_laenge_km, p_kategorien, 'ganzjaehrig', false, p_charakter_text,
    p_tempolimits, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;
