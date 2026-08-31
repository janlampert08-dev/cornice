-- Bundle of two independent hardening fixes found during a code review.
-- Each section stands on its own, mirroring 0027's style.

-- =====================================================================
-- A) propose_route_full trusted the client-supplied p_laenge_km outright
--    and stored it as-is, with no relation to the submitted geometry
--    itself. A user could pair a legitimate route geometry with an
--    arbitrary laenge_km (e.g. to inflate distance-based leaderboard
--    stats) — the moderation queue is the only check on this, and a
--    plausible-looking number is easy to miss on review. laenge_km is
--    now always derived from ST_Length() of the submitted geometry
--    itself, the same source of truth already used for start_coord/
--    ziel_coord/geometry below. p_laenge_km stays in the signature for
--    API compatibility with the existing call site (lib/actions/routes.ts)
--    but is no longer used.
-- =====================================================================
create or replace function public.propose_route_full(
  p_name text,
  p_region text,
  p_start_ort text,
  p_ziel_ort text,
  p_geometry_geojson jsonb,
  p_laenge_km numeric,
  p_kategorien text[],
  p_charakter_text text,
  p_tempolimits jsonb,
  p_hoehe_m integer default null,
  p_max_steigung_prozent numeric default null,
  p_kehren integer default null,
  p_hoehenprofil jsonb default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_geom geometry;
  v_laenge_km numeric;
begin
  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson::text), 4326);
  v_laenge_km := ST_Length(v_geom::geography) / 1000.0;

  insert into public.routes (
    name, region, start_ort, ziel_ort,
    start_coord, ziel_coord, geometry,
    laenge_km, kategorien, saison_status, status_ok, charakter_text,
    tempolimits, hoehe_m, max_steigung_prozent, kehren, hoehenprofil, erstellt_von
  ) values (
    p_name, p_region, p_start_ort, p_ziel_ort,
    ST_StartPoint(v_geom)::geography,
    ST_EndPoint(v_geom)::geography,
    v_geom::geography,
    v_laenge_km, p_kategorien, 'ganzjaehrig', false, p_charakter_text,
    p_tempolimits, p_hoehe_m, p_max_steigung_prozent, p_kehren, p_hoehenprofil, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- =====================================================================
-- B) route-photos/avatars buckets (0003_storage.sql, 0015_profil_
--    sichtbarkeit_avatar.sql) had no allowed_mime_types restriction. The
--    only gate was the app-level check in lib/actions/completions.ts /
--    lib/actions/profile.ts (file.type.startsWith("image/")), which reads
--    the client-supplied, attacker-controllable Content-Type of the
--    upload — not the actual file content. A crafted file labeled e.g.
--    image/svg+xml (SVG can embed <script>) would pass that check and be
--    served back publicly from the bucket with the same content type, a
--    potential stored-XSS vector. Restricting both buckets to a fixed set
--    of raster formats closes this off at the storage layer regardless of
--    what the app-level check does, without relying on parsing file
--    content server-side.
-- =====================================================================
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id in ('route-photos', 'avatars');
