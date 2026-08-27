-- Premium/Abo-Grundgerüst. ist_premium wird vorerst manuell per SQL gesetzt
-- (kein Zahlungsanbieter angebunden) — Grundlage für eine spätere Anbindung
-- an eine echte Abo-Zahlung (z.B. Stripe-Webhook setzt dieses Feld).
alter table public.profiles
  add column ist_premium boolean not null default false,
  add column zeigt_premium_badge boolean not null default false;

comment on column public.profiles.ist_premium is
  'Premium-Status. Vorerst manuell per SQL gesetzt (kein Zahlungsanbieter angebunden) — Grundlage für spätere Anbindung an eine Abo-Zahlung.';
comment on column public.profiles.zeigt_premium_badge is
  'Opt-in: dezentes Premium-Symbol neben dem Namen für andere Nutzer sichtbar. Nur wirksam, wenn ist_premium = true.';

-- Private, eigene Strecken (Premium-Feature): ohne Moderationspflicht
-- nutzbar, aber nicht öffentlich sichtbar/auffindbar, bis der Ersteller sie
-- explizit veröffentlicht (siehe publishPrivateRoute in lib/actions/routes.ts).
alter table public.routes
  add column ist_privat boolean not null default false;

comment on column public.routes.ist_privat is
  'Premium-Feature: private Strecke, nur für den Ersteller sichtbar (auch für Moderatoren, bis veröffentlicht). Erstellung nur für Premium-Nutzer, serverseitig geprüft in lib/actions/routes.ts.';

-- Moderatoren sehen private Strecken nicht, solange sie nicht veröffentlicht
-- wurden (ist_privat=false) — ersetzt die bisherige Policy aus 0009, die noch
-- keine Privatsphäre-Unterscheidung kannte.
drop policy "Moderatoren sehen auch unveröffentlichte Strecken" on public.routes;

create policy "Moderatoren sehen auch unveröffentlichte, nicht-private Strecken"
  on public.routes for select
  using (
    ist_privat = false
    and exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true)
  );

-- routes_geojson um ist_privat ergänzen (an bestehende Spaltenreihenfolge
-- angehängt — CREATE OR REPLACE VIEW erlaubt kein Umsortieren).
create or replace view public.routes_geojson
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
  created_at,
  ist_privat
from public.routes;

-- Premium-Abzeichen ("Trophäe" neben dem Namen) in beiden Bestenlisten-Views
-- verfügbar machen — angehängt, damit CREATE OR REPLACE VIEW nicht an der
-- bestehenden Spaltenreihenfolge scheitert. Das Symbol selbst ist weiterhin
-- an zeigt_premium_badge (Opt-in) gebunden, nicht automatisch sichtbar.
create or replace view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km,
  p.ist_premium,
  p.zeigt_premium_badge
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where r.status_ok = true and rc.ist_oeffentlich = true;

create or replace view public.route_leaderboard as
select
  rc.id as completion_id,
  rc.route_id,
  rc.user_id,
  p.display_name,
  rc.dauer_sekunden,
  rc.distanz_km,
  rc.datum,
  p.ist_premium,
  p.zeigt_premium_badge
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
where rc.ist_oeffentlich = true and rc.dauer_sekunden is not null;
