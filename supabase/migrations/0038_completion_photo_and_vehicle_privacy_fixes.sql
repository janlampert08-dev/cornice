-- Behebt drei Lücken, die bei der Review von 0035/0036 auffielen (siehe
-- Plan/Review). 0035/0036 sind bereits angewendet (Core Rule #9: keine
-- angewendete Migration nachträglich ändern) — daher hier als eigene,
-- neue Migration statt Bearbeitung der bestehenden Dateien.

-- =====================================================================
-- A) completion_photos (0036) erlaubte beim INSERT jeden beliebigen
--    completion_id-Wert, solange user_id = auth.uid() gesetzt war — die
--    Policy prüfte nie, ob completion_id tatsächlich zu einer eigenen
--    Fahrt gehört. Ein authentifizierter Nutzer konnte damit ein Foto an
--    die (öffentliche) Fahrt eines FREMDEN Nutzers hängen, das dort dann
--    fälschlich als "Foto von {Name des Fahrt-Besitzers}" erscheint (die
--    Galerie zeigt bewusst nur den Namen des Fahrt-Besitzers, kein
--    Uploader-Feld pro Foto). Gleiches Muster wie kudos (0029_kudos.sql),
--    das genau diesen exists-Check bereits für sein completion_id hat.
drop policy if exists "Nutzer verwalten eigene Fahrt-Fotos" on public.completion_photos;
create policy "Nutzer verwalten eigene Fahrt-Fotos"
  on public.completion_photos for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.route_completions rc
      where rc.id = completion_id and rc.user_id = auth.uid()
    )
  );

-- =====================================================================
-- B) public_completion_photos (0036) filterte nur auf rc.ist_oeffentlich,
--    ohne (anders als sein direktes Geschwister public_fahrten, 0035) auch
--    r.status_ok zu prüfen — Fotos einer nachträglich abgelehnten/
--    zurückgezogenen Strecke blieben dadurch über die View weiterhin
--    abrufbar, obwohl die Fahrt selbst (public_fahrten) bereits verschwand.
-- =====================================================================
create or replace view public.public_completion_photos as
select
  cp.id,
  cp.completion_id,
  cp.foto_url,
  cp.position,
  p.display_name
from public.completion_photos cp
join public.route_completions rc on rc.id = cp.completion_id
join public.routes r on r.id = rc.route_id
join public.profiles p on p.id = cp.user_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by cp.position asc;

comment on view public.public_completion_photos is
  'Alle Fotos einer einzelnen öffentlichen Fahrt, für die Fotos-Sektion auf app/fahrten/[id]/page.tsx (nicht-Besitzer-Pfad). Läuft bewusst mit den Rechten des View-Owners (bypasst RLS), gefiltert auf ist_oeffentlich = true UND r.status_ok = true — wie public_fahrten (0035). Ersetzt die 0036-Fassung, der der status_ok-Filter fehlte.';

-- =====================================================================
-- C) Kein DB-seitiger Deckel auf Fotos pro Fahrt — MAX_PHOTOS_PER_COMPLETION
--    (lib/actions/completions.ts) ist nur ein App-seitiger .slice(), der
--    sich durch einen direkten INSERT über den Supabase-Client umgehen
--    lässt (RLS erlaubte das ohnehin schon, siehe Fix A oben, der das
--    zumindest auf eigene Fahrten einschränkt). Gleiches Muster wie
--    enforce_completion_cooldown/enforce_rating_cooldown (0024): App-Check
--    bleibt als schnelles Feedback, echte Durchsetzung per Trigger.
create or replace function public.enforce_completion_photo_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  photo_count integer;
begin
  select count(*) into photo_count
  from public.completion_photos
  where completion_id = new.completion_id;

  if photo_count >= 6 then
    raise exception 'photo_limit_exceeded';
  end if;

  return new;
end;
$$;

drop trigger if exists completion_photos_limit on public.completion_photos;
create trigger completion_photos_limit
  before insert on public.completion_photos
  for each row execute procedure public.enforce_completion_photo_limit();

-- =====================================================================
-- D) public_fahrten (0035) gab Fahrzeugdaten (fahrzeug_typ/marke/modell)
--    OHNE Rücksicht auf zeigt_fahrzeuge preis — die einzige bestehende
--    Opt-in-Einstellung, die genau diese Daten sonst überall (RLS auf
--    vehicles, 0015; öffentliches Profil, lib/profile.ts) steuert. Ein
--    Nutzer mit zeigt_fahrzeuge = false (Standard) hätte trotzdem sein
--    Fahrzeug auf jeder öffentlichen Fahrt-Detailseite offengelegt
--    bekommen. Fix: gleiche Opt-in-Klammer wie bei avatar_url (zeigt_avatar)
--    — zusätzlich per auth.uid() = rc.user_id immer für den Besitzer selbst
--    sichtbar (zeigt_fahrzeuge blendet nur vor ANDEREN aus, nicht vor sich
--    selbst).
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
  case when p.zeigt_fahrzeuge or rc.user_id = auth.uid() then v.typ else null end as fahrzeug_typ,
  case when p.zeigt_fahrzeuge or rc.user_id = auth.uid() then v.marke else null end as fahrzeug_marke,
  case when p.zeigt_fahrzeuge or rc.user_id = auth.uid() then v.modell else null end as fahrzeug_modell
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
left join public.vehicles v on v.id = rc.fahrzeug_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;

comment on view public.public_fahrten is
  'Oeffentliche Fahrten fuer Fahrt-Detailseite/Profil, laeuft bewusst mit den Rechten des View-Owners (bypasst RLS). notiz/abdeckung_prozent sind fuer jeden Betrachter sichtbar sobald die Fahrt oeffentlich ist (0035). Fahrzeugdaten respektieren zusaetzlich zeigt_fahrzeuge (0015) wie ueberall sonst im Produkt, ausser fuer den Besitzer selbst — siehe 0038_completion_photo_and_vehicle_privacy_fixes.sql.';
