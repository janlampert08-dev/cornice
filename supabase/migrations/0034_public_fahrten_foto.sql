-- Fügt route_completions.foto_url an public_fahrten (0015/0017/0018/0029/
-- 0030/0032) an — für die Fotos-Sektion auf der Fahrt-Detailseite
-- (app/fahrten/[id]/page.tsx), inkl. Entfernen-Button für den Besitzer
-- (lib/actions/completions.ts removeCompletionPhoto). Keine neue
-- Datenfreigabe: foto_url öffentlicher Fahrten ist bereits über
-- route_photos (0009/0027) auf der Streckenseite sichtbar, hier nur
-- zusätzlich über public_fahrten für die einzelne Fahrt verfügbar. Als
-- letzte Spalte angehängt (CREATE OR REPLACE VIEW erlaubt keine
-- Umsortierung bestehender Spalten).
create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum,
  rc.distanz_km,
  rc.id as completion_id,
  p.display_name,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url,
  rc.dauer_sekunden,
  rc.foto_url
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;
