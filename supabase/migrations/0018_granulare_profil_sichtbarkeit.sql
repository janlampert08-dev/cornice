-- Feinere Kontrolle über das öffentliche Profil: bisher zeigte
-- zeigt_fahrzeuge nur die Fahrzeugliste, alles andere auf /fahrer/[id]
-- (Profilbild, Pässe-Zähler, Höhenmeter) war entweder immer sichtbar oder an
-- die inzwischen entfernte zeigt_fahrten-Einstellung gekoppelt. Jetzt vier
-- unabhängige Opt-ins, standardmässig aus wie der Rest der Privatsphäre-
-- Einstellungen (siehe 0015/0017).
alter table public.profiles
  add column zeigt_avatar boolean not null default false,
  add column zeigt_paesse boolean not null default false,
  add column zeigt_hoehenmeter boolean not null default false,
  add column zeigt_distanz boolean not null default false;

comment on column public.profiles.zeigt_avatar is
  'Opt-in: hochgeladenes Profilbild auf dem öffentlichen Profil sichtbar (sonst Initialen-Platzhalter).';
comment on column public.profiles.zeigt_paesse is
  'Opt-in: Anzahl befahrener Pässe auf dem öffentlichen Profil sichtbar.';
comment on column public.profiles.zeigt_hoehenmeter is
  'Opt-in: gesammelte Höhenmeter auf dem öffentlichen Profil sichtbar.';
comment on column public.profiles.zeigt_distanz is
  'Opt-in: gesamte GPS-getrackte Distanz auf dem öffentlichen Profil sichtbar.';

-- distanz_km fehlte bisher in public_fahrten (nur für die private
-- /profil-Ansicht berechnet) — wird für die neue zeigt_distanz-Summe
-- gebraucht. Muss als letzte Spalte angehängt werden (CREATE OR REPLACE VIEW
-- erlaubt keine Umsortierung bestehender Spalten).
create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum,
  rc.distanz_km
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;
