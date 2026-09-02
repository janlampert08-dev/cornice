-- Freie Fahrten teilen: zweiter Schritt nach 0044_freie_fahrten.sql. Bis
-- hierhin waren freie Fahrten immer privat, weil zum Teilen zwei Dinge
-- fehlten — eine Privatzone um Start und Ziel und ein Meldeweg für Fahrten
-- (letzterer in 0046_fahrt_meldungen.sql, beide gehen zusammen live).

-- ---------------------------------------------------------------------------
-- A) Privatzone: Umkreis um Start und Ziel, der aus dem öffentlich
--    sichtbaren Track entfernt wird.
--
--    Ein roher GPS-Track beginnt und endet vor der eigenen Haustür. Ohne
--    Kappung wäre jede geteilte Fahrt eine Adressangabe — deshalb ist die
--    Privatzone standardmässig AN (200 m) und nicht ein Opt-in, das man
--    erst suchen muss. Die Kappung selbst rechnet die App (cropTrackEnds
--    in lib/track.ts, mit Haversine-Abständen in Metern) und legt das
--    Ergebnis in track_oeffentlich ab; in SQL wäre sie nur näherungsweise
--    möglich, weil ST_LineSubstring auf Bruchteilen der planaren Länge in
--    Grad arbeitet und der Umrechnungsfaktor je nach Fahrtrichtung um bis
--    zu 1/cos(lat) danebenliegt. Bei einer Privatsphäre-Zusage ist "grob
--    richtig" zu wenig.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column privatzone_radius_m smallint not null default 200
  check (privatzone_radius_m in (0, 100, 200, 500));

comment on column public.profiles.privatzone_radius_m is
  'Radius der Privatzone in Metern: Start und Ziel werden in diesem Umkreis aus dem öffentlich sichtbaren Track entfernt (0 = aus). Standard 200 m — bewusst aktiv voreingestellt, siehe 0045_freie_fahrten_teilen.sql.';

-- Spaltengenaue Grants nachziehen: 0034 hat die Tabellen-Grants auf
-- profiles bewusst entzogen und nur einzelne Spalten wieder freigegeben.
-- Ohne diese beiden Zeilen könnte niemand die eigene Einstellung lesen
-- oder ändern. Column-Grants sind additiv, die Liste aus 0034 bleibt.
grant update (privatzone_radius_m) on public.profiles to authenticated;
grant select (privatzone_radius_m) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- B) Der öffentlich sichtbare Track: die gekappte Fassung von
--    route_completions.track (0044).
--
--    Zwei Spalten statt einer, weil sie zwei verschiedene Dinge sind: track
--    ist die vollständige eigene Aufzeichnung (nur per RLS für den Besitzer
--    lesbar, Grundlage für jede Neuberechnung), track_oeffentlich ist das,
--    was andere sehen dürfen. Nur diese Spalte darf je in einer der Views
--    auftauchen, die mit Owner-Rechten laufen und RLS umgehen.
--
--    Gefüllt wird sie beim Veröffentlichen (lib/actions/completions.ts) und
--    beim Ändern des Radius (lib/actions/profile.ts); wird eine Fahrt wieder
--    privat, wird sie auf null zurückgesetzt, damit keine öffentliche
--    Geometrie einer nicht mehr geteilten Fahrt liegen bleibt.
-- ---------------------------------------------------------------------------
alter table public.route_completions
  add column track_oeffentlich geography(LineString, 4326);

comment on column public.route_completions.track_oeffentlich is
  'Öffentlich sichtbarer Track: track (0044) ohne Anfang und Ende innerhalb der Privatzone des Fahrers (profiles.privatzone_radius_m). Nur gesetzt, solange die Fahrt öffentlich ist. Der rohe track selbst darf niemals über eine RLS-umgehende View nach aussen gelangen.';

-- ---------------------------------------------------------------------------
-- C) public_fahrten (0017/0018/0029/0030/0032/0034/0035) trägt ab jetzt
--    beide Fahrtarten.
--
--    Der innere Join auf routes wird zum LEFT JOIN — und genau hier liegt
--    die Falle: ein naiver Filter wie "coalesce(r.status_ok, true)" oder
--    "r.id is null or r.status_ok" würde eine Fahrt auf einer noch nicht
--    freigegebenen oder auf einer privaten Premium-Strecke als "Fahrt ohne
--    Strecke" durchlassen, also als freie Fahrt in den Feed spülen. Die
--    Sichtbarkeit hängt deshalb ausdrücklich an art:
--      - art = 'frei'    -> keine Strecke, keine Streckenprüfung nötig
--      - art = 'strecke' -> nur mit freigegebener Strecke (status_ok)
--    Der CHECK aus 0044 garantiert dabei, dass art und route_id nicht
--    auseinanderlaufen können.
--
--    region fällt für freie Fahrten auf den beim Speichern ermittelten
--    Ortsbezug zurück; route_name und laenge_km sind für sie null (die App
--    zeigt stattdessen titel bzw. die tatsächlich gefahrene distanz_km).
--    Neue Spalten hängen hinten an — CREATE OR REPLACE VIEW erlaubt kein
--    Umsortieren bestehender Spalten.
-- ---------------------------------------------------------------------------
create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  coalesce(r.region, rc.region) as region,
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
  v.modell as fahrzeug_modell,
  rc.art,
  rc.titel,
  rc.start_ort,
  rc.bewegte_zeit_sekunden,
  rc.hoehenmeter_aufstieg
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
left join public.routes r on r.id = rc.route_id
left join public.vehicles v on v.id = rc.fahrzeug_id
where rc.ist_oeffentlich = true
  and (
    (rc.art = 'frei' and rc.route_id is null)
    or (rc.art = 'strecke' and r.status_ok = true)
  );

comment on view public.public_fahrten is
  'Oeffentliche Fahrten fuer Feed, Profil und Fahrt-Detailseite, laeuft bewusst mit den Rechten des View-Owners (bypasst RLS). Ab 0045 beide Fahrtarten: der Streckenteil bleibt an status_ok gebunden, der freie Teil ausdruecklich an art = ''frei'' und route_id is null — ein LEFT JOIN ohne diese Kopplung wuerde Fahrten auf unfreigegebenen oder privaten Strecken als freie Fahrten durchlassen. Der rohe GPS-Track ist hier bewusst NICHT enthalten, nur die gekappte Fassung in public_fahrt_tracks.';

-- ---------------------------------------------------------------------------
-- D) Der öffentliche Track einer einzelnen Fahrt, für die Detailseite.
--    Bewusst eine eigene View statt einer weiteren Spalte in
--    public_fahrten: lib/feed.ts liest dort mit select("*"), und der Feed
--    soll nicht bei jedem Aufruf dreissig vollständige Geometrien laden.
-- ---------------------------------------------------------------------------
create view public.public_fahrt_tracks as
select
  rc.id as completion_id,
  ST_AsGeoJSON(rc.track_oeffentlich)::json as track_geojson
from public.route_completions rc
where rc.ist_oeffentlich = true and rc.track_oeffentlich is not null;

grant select on public.public_fahrt_tracks to anon, authenticated;

comment on view public.public_fahrt_tracks is
  'Gekappter GPS-Track einer oeffentlichen Fahrt. Laeuft mit den Rechten des View-Owners (bypasst RLS) und liefert ausschliesslich track_oeffentlich — der rohe track bleibt dem Besitzer vorbehalten (fahrt_tracks, security_invoker).';

-- ---------------------------------------------------------------------------
-- E) Kontolöschung (0042) muss die Fahrten mitnehmen.
--
--    Die Anonymisierung entfernte bisher Name, Avatar und alle
--    Sichtbarkeits-Opt-ins — die Fahrten selbst blieben absichtlich
--    erhalten, damit Bestenlisten und Statistiken nicht auseinanderfallen
--    (siehe 0042). Mit gespeicherten GPS-Tracks reicht das nicht mehr: eine
--    geteilte Fahrt bliebe als Spur bis zur Haustür stehen, nur ohne Namen
--    daneben.
--
--    Deshalb genau zwei Ergänzungen, ohne die Grundentscheidung von 0042
--    umzudrehen:
--      1. Sämtliche Geometrie wird entfernt (track und track_oeffentlich).
--         Der rohe Track nützt niemandem mehr — der Zugang zum Konto ist
--         entwertet — und ist die sensibelste Spalte der Tabelle.
--      2. Freie Fahrten werden zusätzlich auf privat gesetzt. Sie sind
--         persönliche Aufzeichnungen mit selbst getipptem Titel und ohne
--         Bezug zu einer kuratierten Strecke; für Bestenlisten zählen sie
--         ohnehin nicht (0044), es geht also nichts verloren, was 0042
--         erhalten wollte. Streckenfahrten bleiben öffentlich und damit in
--         den Bestenlisten, wie bisher.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set
    display_name = 'Gelöschtes Konto',
    avatar_url = null,
    zeigt_fahrzeuge = false,
    zeigt_avatar = false,
    zeigt_paesse = false,
    zeigt_hoehenmeter = false,
    zeigt_distanz = false,
    zeigt_follower_liste = false,
    zeigt_premium_badge = false,
    is_moderator = false,
    ist_premium = false
  where id = auth.uid();

  update public.route_completions
  set
    track = null,
    track_oeffentlich = null,
    ist_oeffentlich = case when art = 'frei' then false else ist_oeffentlich end
  where user_id = auth.uid();

  delete from public.vehicles where user_id = auth.uid();
end;
$$;

grant execute on function public.anonymize_own_account() to authenticated;
