-- RPC-Funktion, damit der Client eine Strecke vorschlagen kann, ohne
-- geography-Werte selbst als WKT/GeoJSON formatieren zu müssen. Läuft mit
-- den Rechten des aufrufenden Nutzers (kein "security definer"), die
-- bestehenden RLS-Policies auf public.routes greifen also unverändert:
-- nur eingeloggte Nutzer, nur mit erstellt_von = auth.uid() und status_ok = false.
--
-- Geometrie ist vorerst eine Gerade zwischen Start- und Zielpunkt (Nutzer
-- setzen zwei Pins) — ein Moderator kann die echte Streckenführung beim
-- Freigeben nachtragen.
create or replace function public.propose_route(
  p_name text,
  p_region text,
  p_start_ort text,
  p_ziel_ort text,
  p_start_lng double precision,
  p_start_lat double precision,
  p_ziel_lng double precision,
  p_ziel_lat double precision,
  p_laenge_km numeric,
  p_kategorien text[],
  p_charakter_text text
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.routes (
    name, region, start_ort, ziel_ort,
    start_coord, ziel_coord, geometry,
    laenge_km, kategorien, saison_status, status_ok, charakter_text, erstellt_von
  ) values (
    p_name, p_region, p_start_ort, p_ziel_ort,
    ST_MakePoint(p_start_lng, p_start_lat)::geography,
    ST_MakePoint(p_ziel_lng, p_ziel_lat)::geography,
    ST_MakeLine(
      ST_MakePoint(p_start_lng, p_start_lat),
      ST_MakePoint(p_ziel_lng, p_ziel_lat)
    )::geography,
    p_laenge_km, p_kategorien, 'ganzjaehrig', false, p_charakter_text, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;
