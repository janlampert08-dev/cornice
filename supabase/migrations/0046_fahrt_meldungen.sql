-- Meldungen für Fahrten. Gehört untrennbar zum Teilen freier Fahrten
-- (0045_freie_fahrten_teilen.sql): eine geteilte freie Fahrt trägt einen
-- frei getippten Titel, eine Notiz und Fotos und hängt an keiner geprüften
-- Strecke — bis hierhin deckte 0043_content_reports.sql nur Strecken und
-- Kommentare ab, für Fahrten gab es keinerlei Meldeweg.
--
-- Aufbau bewusst identisch zu route_reports/rating_reports (0043): eine
-- Tabelle pro Beziehungsart mit echtem Fremdschlüssel statt einer
-- polymorphen Referenz.

create table public.completion_reports (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.route_completions (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  grund text not null check (grund in ('unangemessen', 'spam', 'falsche_angaben', 'sonstiges')),
  kommentar text,
  status text not null default 'offen' check (status in ('offen', 'erledigt')),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  bearbeitet_von uuid references auth.users (id) on delete set null,
  -- Verhindert wiederholtes Melden derselben Fahrt durch denselben Nutzer,
  -- wie bei route_reports (0043).
  unique (completion_id, reporter_id)
);

create index completion_reports_status_idx on public.completion_reports (status);

alter table public.completion_reports enable row level security;

-- Gemeldet werden kann nur, was auch öffentlich ist. Sonst liesse sich über
-- diesen Weg herausfinden, ob eine bestimmte (private) Fahrt existiert —
-- dieselbe Überlegung wie bei den Kudos-Policies (0029).
--
-- Geprüft wird über public_fahrten, nicht direkt über route_completions:
-- der Ausdruck einer Policy läuft mit den Rechten des Aufrufers, und die
-- SELECT-Policy auf route_completions (0001) zeigt jedem nur die eigenen
-- Zeilen. Eine Prüfung dort wäre für jede fremde Fahrt falsch — also genau
-- für die, die man überhaupt melden will. public_fahrten läuft dagegen mit
-- den Rechten des View-Owners und enthält ohnehin nur öffentliche Fahrten
-- (und bei Streckenfahrten nur solche auf freigegebenen Strecken).
create policy "Angemeldete Nutzer können öffentliche Fahrten melden"
  on public.completion_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.public_fahrten pf
      where pf.completion_id = completion_reports.completion_id
    )
  );

create policy "Moderatoren sehen gemeldete Fahrten"
  on public.completion_reports for select
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_moderator = true));

create policy "Moderatoren bearbeiten gemeldete Fahrten"
  on public.completion_reports for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_moderator = true));

comment on table public.completion_reports is
  'Meldungen zu geteilten Fahrten (Titel, Notiz, Fotos, Track). Gemeldet werden kann nur eine öffentliche Fahrt — siehe Insert-Policy.';

-- ---------------------------------------------------------------------------
-- Moderatoren müssen eine gemeldete Fahrt aus der Öffentlichkeit nehmen
-- können. Bewusst nur das und kein Löschen: das Entöffentlichen ist das
-- mildeste wirksame Mittel, die Fahrt bleibt dem Fahrer erhalten (bei einer
-- Strecke oder einem Kommentar ist Löschen die einzige sinnvolle Massnahme,
-- bei einer persönlichen Aufzeichnung nicht).
--
-- Damit aus dieser Policy kein allgemeines Schreibrecht auf fremde Fahrten
-- wird, folgt sie dem Muster aus 0034_profiles_column_grant_hardening.sql:
-- das Tabellen-Recht auf UPDATE wird entzogen und nur für die drei Spalten
-- wieder erteilt, die überhaupt nachträglich geändert werden (siehe
-- toggleCompletionVisibility, updateCompletionNotiz, recomputePublicTracks).
-- Distanz, Dauer, Deckungsgrad und der Track selbst sind damit für niemanden
-- mehr nachträglich änderbar — auch nicht für den Fahrer.
revoke update on public.route_completions from anon, authenticated;
grant update (ist_oeffentlich, notiz, track_oeffentlich) on public.route_completions to authenticated;

create policy "Moderatoren können Fahrten entöffentlichen"
  on public.route_completions for update
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_moderator = true));

comment on policy "Moderatoren können Fahrten entöffentlichen" on public.route_completions is
  'Additiv zur Besitzer-Policy (0001) — mehrere permissive Policies werden per OR verknüpft. Was tatsächlich geändert werden kann, begrenzen die Spalten-Grants aus dieser Migration.';
