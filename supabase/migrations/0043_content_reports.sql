-- Melden von Inhalten: bislang gab es keinen Weg, eine unangemessene Strecke
-- oder einen unangemessenen Kommentar zu melden — nur neue Streckenvorschläge
-- durchliefen überhaupt eine Prüfung (Moderationswarteschlange). Öffentliche
-- Profile, Kommentare und der Feed hatten keinerlei Melde-Mechanismus.
--
-- Zwei eigene Tabellen statt einer polymorphen (route_id/rating_id + ein
-- "typ"-Feld) — folgt demselben Muster wie kudos/favorites/follows in
-- diesem Schema: eine Tabelle pro Beziehungsart, mit echten
-- Fremdschlüsseln statt einer nicht erzwingbaren polymorphen Referenz.

create table public.route_reports (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  grund text not null check (grund in ('unangemessen', 'spam', 'falsche_angaben', 'sonstiges')),
  kommentar text,
  status text not null default 'offen' check (status in ('offen', 'erledigt')),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  bearbeitet_von uuid references auth.users (id) on delete set null,
  -- Verhindert wiederholtes Melden derselben Strecke durch denselben Nutzer
  -- (Spam auf der Meldungs-Warteschlange selbst) — eine erneute, inhaltlich
  -- andere Meldung nach einer bereits erledigten ist weiterhin möglich, da
  -- sich der Unique-Index nur gegen exakt denselben offenen Datensatz richtet
  -- (kein partial index nötig: pro (route_id, reporter_id) ergibt ohnehin nur
  -- ein zweiter INSERT-Versuch überhaupt einen Konflikt).
  unique (route_id, reporter_id)
);

create index route_reports_status_idx on public.route_reports (status);

alter table public.route_reports enable row level security;

create policy "Angemeldete Nutzer können Strecken melden"
  on public.route_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Moderatoren sehen gemeldete Strecken"
  on public.route_reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

create policy "Moderatoren bearbeiten gemeldete Strecken"
  on public.route_reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

create table public.rating_reports (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.route_ratings (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  grund text not null check (grund in ('unangemessen', 'spam', 'falsche_angaben', 'sonstiges')),
  kommentar text,
  status text not null default 'offen' check (status in ('offen', 'erledigt')),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  bearbeitet_von uuid references auth.users (id) on delete set null,
  unique (rating_id, reporter_id)
);

create index rating_reports_status_idx on public.rating_reports (status);

alter table public.rating_reports enable row level security;

create policy "Angemeldete Nutzer können Kommentare melden"
  on public.rating_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Moderatoren sehen gemeldete Kommentare"
  on public.rating_reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

create policy "Moderatoren bearbeiten gemeldete Kommentare"
  on public.rating_reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));

-- Moderatoren brauchen eine Möglichkeit, einen gemeldeten Kommentar direkt zu
-- entfernen — anders als bei Strecken (0009: "Moderatoren können Strecken
-- ablehnen (löschen)") gab es dafür noch keine Policy. Additiv zur
-- bestehenden "Nutzer verwalten eigene Bewertungen"-Policy (for all, 0001) —
-- mehrere permissive Policies für denselben Befehl werden in Postgres per OR
-- verknüpft, diese hier schränkt also nichts ein, sie erweitert nur, wer
-- zusätzlich zum Autor selbst löschen darf.
create policy "Moderatoren können Bewertungen löschen"
  on public.route_ratings for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_moderator = true));
