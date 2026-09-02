-- Freie Fahrten: eine aufgezeichnete Fahrt ohne Bezug zu einer kuratierten
-- Strecke. Bisher war "Fahrt" gleichbedeutend mit "Befahrung einer Strecke"
-- (route_completions.route_id NOT NULL, 0001_init.sql) — Aufzeichnen liess
-- sich nur von einer Streckenseite aus starten.
--
-- Bewusst dieselbe Tabelle statt einer zweiten (free_rides + Union-View):
-- kudos.completion_id (0029) und completion_photos.completion_id (0036)
-- hängen per echtem Fremdschlüssel an route_completions.id. Eine zweite
-- Tabelle erzwänge entweder eine zweite Kudos-/Foto-Tabelle oder polymorphe
-- Referenzen — Letzteres verbietet sich dieses Schema ausdrücklich selbst
-- (siehe Begründung in 0043_content_reports.sql).
--
-- Preis dieser Entscheidung, bewusst in Kauf genommen: route_id ist ab hier
-- nullable, jede streckenbezogene Abfrage braucht deshalb einen expliziten
-- Filter. Dafür gibt es die Spalte "art" als ausdrücklichen Diskriminator
-- (statt überall auf "route_id is null" zu prüfen) plus einen CHECK, der
-- beide Zustände aneinander koppelt.
--
-- Der Tabellenname bleibt route_completions: ein Rename wäre in Postgres
-- billig (Views/Policies folgen automatisch), in der App aber teuer — der
-- Name steht als String in rund einem Dutzend Dateien.

alter table public.route_completions
  add column art text not null default 'strecke' check (art in ('strecke', 'frei')),
  add column titel text,
  add column start_ort text,
  add column region text,
  add column bewegte_zeit_sekunden integer,
  add column hoehenmeter_aufstieg numeric,
  add column hoehenprofil jsonb,
  -- Der aufgezeichnete GPS-Track selbst. Bis hierhin wurde der Trail nur zur
  -- Berechnung von Distanz/Dauer/Deckungsgrad benutzt und danach verworfen —
  -- eine freie Fahrt hätte damit buchstäblich nichts zu zeigen (keine Karte,
  -- kein Teilen-Bild, kein Höhenprofil). Gespeichert wird eine vereinfachte
  -- Fassung (Douglas-Peucker, siehe lib/track.ts), nicht die Rohpunkte.
  --
  -- WICHTIG: Diese Spalte ist der Roh-Track inkl. Start- und Endpunkt und
  -- damit potenziell die Wohnadresse. Sie ist ausschliesslich über RLS
  -- (Besitzer) erreichbar und darf NIE in einer der Views auftauchen, die
  -- mit den Rechten ihres Owners laufen und RLS umgehen (public_fahrten,
  -- route_photos, public_completion_photos). Die öffentliche, an den Enden
  -- gekappte Fassung kommt mit der Teilen-Phase als eigene Spalte dazu.
  add column track geography(LineString, 4326);

alter table public.route_completions
  alter column route_id drop not null,
  alter column abdeckung_prozent drop not null;

-- Koppelt Art, Streckenbezug und Deckungsgrad, damit kein Mischzustand
-- entstehen kann (freie Fahrt mit route_id, Streckenfahrt ohne). Bestehende
-- Zeilen erfüllen die Bedingung unverändert: art = 'strecke' (Default),
-- route_id gesetzt, abdeckung_prozent nicht null (Default 100 aus 0019).
alter table public.route_completions
  add constraint fahrt_art_konsistent check (
    (art = 'strecke' and route_id is not null and abdeckung_prozent is not null)
    or (art = 'frei' and route_id is null and abdeckung_prozent is null)
  ),
  -- Freitext-Titel nur bei freien Fahrten (Streckenfahrten tragen den
  -- Streckennamen). Längenbegrenzung zusätzlich zur App-seitigen Kürzung,
  -- gleiche Logik wie bei notiz (0020).
  add constraint fahrt_titel_nur_frei check (titel is null or art = 'frei'),
  add constraint fahrt_titel_laenge check (titel is null or char_length(titel) <= 80);

comment on table public.route_completions is
  'Aufgezeichnete Fahrten — seit 0044_freie_fahrten.sql zwei Arten: art = ''strecke'' (Befahrung einer kuratierten Strecke, route_id + abdeckung_prozent gesetzt) und art = ''frei'' (freie Fahrt ohne Streckenbezug, titel/start_ort/region gesetzt). Der Tabellenname stammt aus der Zeit, als es nur die erste Art gab.';
comment on column public.route_completions.art is
  'Diskriminator: ''strecke'' oder ''frei''. Streckenbezogene Abfragen (Bestenlisten, Streckenseite, Pässe-/Höhenmeterzähler) müssen explizit auf art = ''strecke'' filtern.';
comment on column public.route_completions.titel is
  'Frei getippter Titel einer freien Fahrt (max. 80 Zeichen). Bei Streckenfahrten null — dort ist der Streckenname der Titel.';
comment on column public.route_completions.start_ort is
  'Per Reverse-Geocoding (lib/geocoding.ts) ermittelter Startort einer freien Fahrt, damit Profil/Feed einen Ortsbezug zeigen können.';
comment on column public.route_completions.region is
  'Region einer freien Fahrt, analog start_ort. Bei Streckenfahrten kommt die Region weiterhin aus routes.region.';
comment on column public.route_completions.bewegte_zeit_sekunden is
  'Reine Bewegtzeit (Segmente über einer Mindestgeschwindigkeit, siehe movingSeconds in lib/track.ts) — Pausen zählen nicht mit. dauer_sekunden bleibt die verstrichene Gesamtzeit und damit die Grundlage der Streckenbestenliste; für lange freie Ausfahrten ist die Bewegtzeit die aussagekräftigere Zahl.';
comment on column public.route_completions.hoehenmeter_aufstieg is
  'Summierter Anstieg der Fahrt in Metern (swisstopo-Höhenprofil, siehe lib/elevation.ts). Best effort: null, wenn der Dienst nicht antwortet oder die Fahrt ausserhalb der Schweiz liegt. Bewusst NICHT dasselbe wie routes.hoehe_m (Scheitelhöhe) — die beiden Grössen werden nirgends vermischt.';
comment on column public.route_completions.hoehenprofil is
  'Höhenprofil der freien Fahrt fürs Diagramm, gleiches Format wie routes.hoehenprofil (0010).';
comment on column public.route_completions.track is
  'Vereinfachter GPS-Track der Fahrt. Enthält Start- und Endpunkt und ist damit personenbezogen — nur per RLS für den Besitzer lesbar, niemals über eine der RLS-umgehenden Views ausliefern.';

-- Lesezugriff auf den eigenen Track als GeoJSON. security_invoker = true
-- (wie routes_geojson, 0002/0021) — die View läuft mit den Rechten des
-- Aufrufers, RLS auf route_completions greift also weiterhin und liefert
-- ausschliesslich eigene Zeilen. Das ist der bewusste Gegenentwurf zu
-- public_fahrten & Co., die absichtlich mit Owner-Rechten laufen.
create view public.fahrt_tracks
with (security_invoker = true) as
select
  rc.id as completion_id,
  rc.user_id,
  ST_AsGeoJSON(rc.track)::json as track_geojson
from public.route_completions rc
where rc.track is not null;

grant select on public.fahrt_tracks to authenticated;

comment on view public.fahrt_tracks is
  'Eigener GPS-Track als GeoJSON für die Fahrt-Detailseite. Läuft mit den Rechten des Aufrufers (security_invoker), liefert also nur eigene Fahrten — die öffentliche, an den Enden gekappte Variante kommt mit der Teilen-Phase separat dazu.';

-- ---------------------------------------------------------------------------
-- Bestenlisten bleiben streckenbasiert.
--
-- Produktentscheid (Geschäftsregel, siehe PR-Beschreibung): freie Fahrten
-- zählen NICHT in den globalen Bestenlisten. Die vier Listen belohnen
-- kuratierte, per Deckungsgrad verifizierte Strecken; eine freie Fahrt ist
-- gegen nichts prüfbar, "meiste Km" wäre sonst mit dem Arbeitsweg gewinnbar.
-- In den eigenen Profilzahlen (Km, Anzahl Fahrten, Aktivitätskalender)
-- zählen sie dagegen mit — siehe app/profil/page.tsx.
--
-- leaderboard_completions schliesst freie Fahrten schon über den inneren
-- Join auf routes aus; route_leaderboard hat gar keinen Join auf routes und
-- verlässt sich bisher allein darauf, dass die Abfrage nach route_id filtert
-- (NULL trifft dort nie). Beides ist hier ab jetzt ausdrücklich formuliert
-- statt implizit — der Filter ist heute wirkungslos (freie Fahrten sind
-- vorerst immer privat) und soll genau dann greifen, wenn das Teilen
-- freier Fahrten dazukommt.
create or replace view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from route_completions rc
  join profiles p on (p.id = rc.user_id)
  join routes r on (r.id = rc.route_id)
where r.status_ok = true and rc.ist_oeffentlich = true and rc.art = 'strecke';

create or replace view public.route_leaderboard as
select
  rc.id as completion_id,
  rc.route_id,
  rc.user_id,
  p.display_name,
  rc.dauer_sekunden,
  rc.distanz_km,
  rc.datum,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge,
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from route_completions rc
  join profiles p on (p.id = rc.user_id)
where rc.ist_oeffentlich = true and rc.dauer_sekunden is not null and rc.art = 'strecke';

-- route_photos (0009/0027/0036) aggregiert Fotos für die Streckenseite und
-- kommt über completion_photos an die Fahrt. Fotos freier Fahrten haben dort
-- nichts zu suchen (route_id wäre NULL) — auch das explizit statt implizit.
create or replace view public.route_photos as
select
  cp.id,
  rc.route_id,
  cp.foto_url,
  rc.datum,
  p.display_name
from public.completion_photos cp
join public.route_completions rc on rc.id = cp.completion_id
join public.profiles p on p.id = cp.user_id
where rc.ist_oeffentlich = true and rc.art = 'strecke'
order by rc.datum desc, cp.position asc;
