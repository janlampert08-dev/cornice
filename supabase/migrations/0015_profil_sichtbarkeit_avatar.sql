-- Öffentliche Profile: granulare, standardmässig private Sichtbarkeits-
-- Einstellungen (Nutzer entscheidet aktiv, was andere sehen) + Avatar.
alter table public.profiles
  add column zeigt_fahrzeuge boolean not null default false,
  add column zeigt_fahrten boolean not null default false,
  add column avatar_url text;

comment on column public.profiles.zeigt_fahrzeuge is
  'Opt-in: eigene Fahrzeuge auf dem öffentlichen Profil sichtbar.';
comment on column public.profiles.zeigt_fahrten is
  'Opt-in: gefahrene Strecken (Pässe/Höhenmeter/km, inkl. globale Bestenlisten) öffentlich sichtbar.';

-- Fahrzeuge zusätzlich sichtbar, wenn der Besitzer das freigegeben hat
-- (ergänzt die bestehende "nur eigene"-Policy aus 0001_init.sql, ersetzt sie
-- nicht — eine Zeile ist sichtbar, wenn IRGENDEINE Policy zutrifft).
create policy "Fahrzeuge sichtbar wenn freigegeben"
  on public.vehicles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = vehicles.user_id and p.zeigt_fahrzeuge = true
    )
  );

-- Bestehende globale Bestenliste (0013) respektiert ab jetzt ebenfalls das
-- neue Opt-in — wer zeigt_fahrten nicht aktiviert hat, taucht nicht mehr auf.
create or replace view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where r.status_ok = true and p.zeigt_fahrten = true;

-- Öffentliche, stark eingeschränkte Sicht auf gefahrene Strecken fürs
-- öffentliche Profil — wie route_photos/leaderboard_completions bewusst
-- ohne security_invoker und ohne dauer_sekunden/fahrzeug_id/foto_url.
create view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where p.zeigt_fahrten = true and r.status_ok = true
order by rc.datum desc;

grant select on public.public_fahrten to anon, authenticated;

-- Avatar-Storage, analog zu route-photos (0003_storage.sql).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatare sind öffentlich lesbar"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Nutzer laden eigenes Avatar hoch"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Nutzer aktualisieren eigenes Avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Nutzer löschen eigenes Avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
