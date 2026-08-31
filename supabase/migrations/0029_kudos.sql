-- Kudos: einfacher Like-Button auf geteilten Fahrten (route_completions mit
-- ist_oeffentlich = true, siehe 0017_pro_fahrt_sichtbarkeit.sql). Kleinster
-- sinnvoller erster Schritt der sozialen Schicht — kein Kommentare-System,
-- kein Folgen, keine Moderation nötig.
--
-- Struktur folgt bewusst dem bestehenden favorites-Muster (0001_init.sql):
-- zusammengesetzter Primärschlüssel statt eigener id-Spalte, da "Kudos
-- geben" ein reines Toggle pro (Nutzer, Fahrt)-Paar ist.
create table public.kudos (
  user_id uuid not null references auth.users (id) on delete cascade,
  completion_id uuid not null references public.route_completions (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, completion_id)
);

create index kudos_completion_id_idx on public.kudos (completion_id);

alter table public.kudos enable row level security;

-- Kudos sind nur auf öffentlichen Fahrten sichtbar/vergebbar — private
-- Fahrten (ist_oeffentlich = false) dürfen über diesen Weg nicht indirekt
-- offengelegt werden (schon die Existenz einer Kudo-Zeile würde verraten,
-- dass eine bestimmte Fahrt existiert).
create policy "Kudos auf öffentlichen Fahrten sind sichtbar"
  on public.kudos for select
  using (
    exists (
      select 1 from public.route_completions rc
      where rc.id = kudos.completion_id and rc.ist_oeffentlich = true
    )
  );

create policy "Nutzer geben Kudos nur auf öffentliche Fahrten"
  on public.kudos for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.route_completions rc
      where rc.id = kudos.completion_id and rc.ist_oeffentlich = true
    )
  );

create policy "Nutzer entfernen eigene Kudos"
  on public.kudos for delete
  using (auth.uid() = user_id);

comment on table public.kudos is
  'Like-Button auf geteilten Fahrten. Ein Nutzer kann pro Fahrt höchstens einmal Kudos geben (Primärschlüssel user_id+completion_id).';

-- Vorberechnete Zähl-View statt einer rohen count(*)-Query pro Client-
-- Request — folgt demselben Muster wie leaderboard_completions/
-- route_leaderboard (0027/0028): das Join auf route_completions filtert
-- serverseitig bereits auf ist_oeffentlich = true, sodass die View selbst
-- ohne zusätzliche RLS-Prüfung sicher an anon/authenticated freigegeben
-- werden kann (private Fahrten tauchen hier nie auf).
create view public.kudos_summary as
select
  k.completion_id,
  count(*) as kudos_count
from public.kudos k
join public.route_completions rc on rc.id = k.completion_id
where rc.ist_oeffentlich = true
group by k.completion_id;

grant select on public.kudos_summary to anon, authenticated;

comment on view public.kudos_summary is
  'Kudos-Anzahl pro Fahrt, nur für öffentliche Fahrten (ist_oeffentlich = true auf route_completions).';

-- public_fahrten (0017/0018) trug bisher keine completion_id — ohne
-- stabile ID lässt sich auf dem öffentlichen Profil (/fahrer/[id]) kein
-- Kudos-Button an die richtige Fahrt binden. Muss als letzte Spalte
-- angehängt werden (CREATE OR REPLACE VIEW erlaubt keine Umsortierung
-- bestehender Spalten).
create or replace view public.public_fahrten as
select
  rc.user_id,
  rc.route_id,
  r.name as route_name,
  r.region,
  r.laenge_km,
  rc.datum,
  rc.distanz_km,
  rc.id as completion_id
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;
