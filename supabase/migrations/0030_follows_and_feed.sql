-- Soziale Schicht, Schritt 2: Folgen ("Abo") + Grundlage für den
-- Community-Feed (app/feed/page.tsx). Baut auf dem bestehenden
-- Kudos-Feature (0029_kudos.sql) auf.

-- =====================================================================
-- A) follows: einfache Folgen-Beziehung. Gleiches Strukturmuster wie
--    favorites/kudos (zusammengesetzter Primärschlüssel statt eigener
--    id-Spalte, da "folgen" ein reines Toggle pro (Nutzer, Nutzer)-Paar
--    ist).
-- =====================================================================
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);

create index follows_followed_id_idx on public.follows (followed_id);

alter table public.follows enable row level security;

-- Ein Nutzer sieht nur die eigenen Kanten (wem er folgt UND wer ihm
-- folgt) — kein öffentliches Folge-Verzeichnis für Dritte. Reicht für den
-- einzigen Zweck dieser Tabelle: den "Folge ich"-Feed-Filter und den
-- Button-Zustand auf dem eigenen bzw. betrachteten Profil.
create policy "Nutzer sehen eigene Folge-Beziehungen"
  on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = followed_id);

create policy "Nutzer folgen anderen Nutzern"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Nutzer entfolgen"
  on public.follows for delete
  using (auth.uid() = follower_id);

comment on table public.follows is
  'Wer wem folgt — steuert nur den "Folge ich"-Filter im Feed (app/feed/page.tsx) und den Folgen-Button auf /fahrer/[id]. Keine zusätzliche Datenfreigabe: öffentliche Fahrten (route_completions.ist_oeffentlich) sind ohnehin für alle sichtbar, gefolgt oder nicht.';

-- =====================================================================
-- B) public_fahrten (0017/0018/0029) um Anzeigename und (opt-in-gated)
--    Avatar erweitert — der Feed muss zeigen, wer die Fahrt gemacht hat.
--    Folgt demselben Muster wie route_leaderboard/leaderboard_completions
--    (0027/0028): avatar_url wird serverseitig auf null gesetzt, wenn der
--    Fahrer zeigt_avatar nicht aktiviert hat, statt das dem Client zu
--    überlassen. Als letzte Spalten angehängt (CREATE OR REPLACE VIEW
--    erlaubt keine Umsortierung bestehender Spalten).
-- =====================================================================
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
  case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
from public.route_completions rc
join public.profiles p on p.id = rc.user_id
join public.routes r on r.id = rc.route_id
where rc.ist_oeffentlich = true and r.status_ok = true
order by rc.datum desc;
