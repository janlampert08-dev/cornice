-- Erweitert public_fahrten (0015/0017/0018/0029/0030/0032/0034) um notiz,
-- abdeckung_prozent und das Fahrzeug — bislang lieferte diese View für JEDEN
-- Betrachter (auch den Besitzer selbst) hartkodiert null für diese Felder,
-- siehe lib/completions.ts. Das war fuer fremde Betrachter beabsichtigt
-- (rein private Felder, siehe 0020_fahrt_notiz.sql), traf aber unbeabsichtigt
-- auch den Besitzer: sobald eine Fahrt oeffentlich gemacht wurde, lief
-- getCompletionDetail ueber public_fahrten statt den direkten
-- route_completions-Zugriff und der Besitzer verlor die Sicht auf die eigene
-- Notiz/Fahrzeug/Abdeckung auf genau dieser Fahrt.
--
-- Business-Entscheidung (siehe Plan): die Notiz einer Fahrt teilt sich ab
-- jetzt dieselbe Sichtbarkeit wie die Fahrt selbst — sobald eine Fahrt
-- oeffentlich ist, ist ihre Notiz fuer jeden Betrachter sichtbar, nicht nur
-- fuer den Besitzer. abdeckung_prozent und das Fahrzeug werden aus demselben
-- Grund mitgegeben (sie waren zuvor nur ueber den Besitzer-Pfad sichtbar,
-- jetzt konsistent ueber beide Pfade).
--
-- Als letzte Spalten angehaengt (CREATE OR REPLACE VIEW erlaubt keine
-- Umsortierung bestehender Spalten, siehe 0034_public_fahrten_foto.sql).
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
  rc.foto_url,
  rc.notiz,
  rc.abdeckung_prozent,
  v.typ as fahrzeug_typ,
  v.marke as fahrzeug_marke,
  v.modell as fahrzeug_modell
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
left join public.vehicles v on v.id = rc.fahrzeug_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;

comment on view public.public_fahrten is
  'Oeffentliche Fahrten fuer Fahrt-Detailseite/Profil, laeuft bewusst mit den Rechten des View-Owners (bypasst RLS). notiz/abdeckung_prozent/Fahrzeug sind ab hier Teil der View: sobald eine Fahrt oeffentlich ist (ist_oeffentlich = true, der einzige Filter dieser View), sind auch diese Felder fuer jeden Betrachter sichtbar, nicht nur fuer den Besitzer — siehe 0035_public_fahrten_notiz.sql fuer die Begruendung.';
