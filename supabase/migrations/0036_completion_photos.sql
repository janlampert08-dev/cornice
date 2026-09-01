-- Mehrere Fotos pro Fahrt statt nur route_completions.foto_url (genau ein
-- Foto). Neue Tabelle statt Erweiterung von route_completions: Fotos sind
-- eine 1:n-Beziehung zu einer Fahrt, kein Spaltenwert. foto_url auf
-- route_completions bleibt unverändert bestehen (nicht destruktiv, kein
-- DROP COLUMN) — es wird nur ab hier nicht mehr beschrieben (siehe
-- lib/actions/completions.ts), bestehende Werte werden unten einmalig
-- nachgezogen.
create table public.completion_photos (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.route_completions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  foto_url text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index completion_photos_completion_id_idx on public.completion_photos (completion_id);
create index completion_photos_user_id_idx on public.completion_photos (user_id);

-- Gleiches RLS-Muster wie route_completions selbst (0001_init.sql): direkter
-- Zugriff nur für den Besitzer. Öffentliche Sichtbarkeit läuft — wie bei
-- public_fahrten/route_photos — ausschliesslich über Views, die mit den
-- Rechten ihres Owners laufen und damit RLS bewusst umgehen, nicht über eine
-- Erweiterung dieser Policies auf anon/authenticated.
alter table public.completion_photos enable row level security;

create policy "Nutzer sehen eigene Fahrt-Fotos"
  on public.completion_photos for select
  using (auth.uid() = user_id);

create policy "Nutzer verwalten eigene Fahrt-Fotos"
  on public.completion_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.completion_photos to authenticated;

-- Einmaliger Backfill: bestehende Einzel-Fotos werden zur ersten (position 0)
-- Zeile der neuen Tabelle.
insert into public.completion_photos (completion_id, user_id, foto_url, position, created_at)
select id, user_id, foto_url, 0, created_at
from public.route_completions
where foto_url is not null;

-- route_photos (0009/0027) aggregierte bisher rc.foto_url direkt (ein Foto
-- pro Fahrt) für die Fotos-Sektion der Streckenseite — ab hier über
-- completion_photos, damit jedes Foto jeder öffentlichen Fahrt dort
-- erscheint, nicht nur das erste. Gleicher Sichtbarkeitsfilter
-- (rc.ist_oeffentlich) wie zuvor.
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
where rc.ist_oeffentlich = true
order by rc.datum desc, cp.position asc;

comment on view public.route_photos is
  'Fotos abgeschlossener Fahrten für die Streckenseite, läuft bewusst mit den Rechten des View-Owners (bypasst RLS). Ab 0036_completion_photos.sql: aggregiert alle Fotos einer Fahrt (vorher nur rc.foto_url, ein Foto pro Fahrt), weiterhin gefiltert auf ist_oeffentlich = true.';

-- Neue View für die Fotos-Sektion der Fahrt-Detailseite selbst (mehrere
-- Fotos EINER Fahrt statt aller Fahrten EINER Strecke wie route_photos) —
-- gleiches Bypass-Prinzip wie public_fahrten/route_photos.
create view public.public_completion_photos as
select
  cp.id,
  cp.completion_id,
  cp.foto_url,
  cp.position,
  p.display_name
from public.completion_photos cp
join public.route_completions rc on rc.id = cp.completion_id
join public.profiles p on p.id = cp.user_id
where rc.ist_oeffentlich = true
order by cp.position asc;

comment on view public.public_completion_photos is
  'Alle Fotos einer einzelnen öffentlichen Fahrt, für die Fotos-Sektion auf app/fahrten/[id]/page.tsx (nicht-Besitzer-Pfad). Läuft bewusst mit den Rechten des View-Owners (bypasst RLS), gefiltert auf ist_oeffentlich = true — siehe public_fahrten für dasselbe Prinzip.';

grant select on public.public_completion_photos to anon, authenticated;
