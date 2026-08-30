-- Bündel aus Security- und Performance-Fixes, ausgelöst durch die Supabase-
-- Advisors (get_advisors) plus manuelle Prüfung der RLS-/Grant-Situation.
-- Jeder Abschnitt ist unabhängig und einzeln nachvollziehbar.

-- =====================================================================
-- A) RLS fehlte auf der PostGIS-Referenztabelle spatial_ref_sys. Enthält
--    keine sensiblen Daten (nur SRID-Definitionen), war aber ohne RLS
--    theoretisch für anon/authenticated beschreibbar.
-- =====================================================================
alter table public.spatial_ref_sys enable row level security;

drop policy if exists "SRID-Referenzdaten sind öffentlich lesbar" on public.spatial_ref_sys;
create policy "SRID-Referenzdaten sind öffentlich lesbar"
  on public.spatial_ref_sys for select
  using (true);

-- =====================================================================
-- B) enforce_completion_cooldown/enforce_rating_cooldown/handle_new_user
--    sind reine Trigger-Funktionen (SECURITY DEFINER), die aber direkt per
--    PostgREST-RPC von anon/authenticated aufrufbar waren. Trigger laufen
--    unabhängig von EXECUTE-Rechten weiter — der Entzug schliesst nur den
--    unnötigen direkten Aufrufweg.
-- =====================================================================
revoke execute on function public.enforce_completion_cooldown() from anon, authenticated;
revoke execute on function public.enforce_rating_cooldown() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- =====================================================================
-- C) propose_route/propose_route_full liefen ohne fixierten search_path.
--    Beide sind SECURITY INVOKER (geringeres Risiko als DEFINER), aber ein
--    fixer search_path ist trotzdem Best Practice, damit kein Schema die
--    verwendeten PostGIS-Funktionen (ST_MakePoint etc., liegen im public-
--    Schema) hijacken kann.
-- =====================================================================
alter function public.propose_route(
  text, text, text, text, double precision, double precision,
  double precision, double precision, numeric, text[], text
) set search_path = public;

alter function public.propose_route_full(
  text, text, text, text, jsonb, numeric, text[], text, jsonb,
  integer, numeric, integer, jsonb
) set search_path = public;

-- =====================================================================
-- D) Fehlende Indizes auf Foreign-Key-Spalten (Advisor: unindexed_foreign_keys).
-- =====================================================================
create index if not exists favorites_route_id_idx on public.favorites (route_id);
create index if not exists route_completions_fahrzeug_id_idx on public.route_completions (fahrzeug_id);
create index if not exists route_ratings_user_id_idx on public.route_ratings (user_id);
create index if not exists routes_erstellt_von_idx on public.routes (erstellt_von);

-- =====================================================================
-- E) RLS-Policy-Aufräumarbeiten.
--
-- E1) Zwei Policies waren exakt redundant zu einer bereits vorhandenen
--     ALL-Policy für dieselbe Zeile/Bedingung (gleiches USING) — reines
--     doppeltes Auswerten pro Query ohne jeden Sicherheitsunterschied.
--     Andere Überlappungen (z.B. Moderator- vs. Owner-Policies auf routes)
--     sind inhaltlich unterschiedlich und bleiben bewusst unangetastet.
-- =====================================================================
drop policy if exists "Nutzer sehen nur eigene Fahrzeuge" on public.vehicles;
drop policy if exists "Nutzer sehen eigene Fahrten" on public.route_completions;

-- =====================================================================
-- E2) auth.uid() wurde in RLS-Policies pro Zeile neu ausgewertet statt
--     einmal pro Query (Advisor: auth_rls_initplan). (select auth.uid())
--     lässt den Planer das Ergebnis cachen. Reine Performance-Optimierung,
--     keine Bedingung ändert sich inhaltlich.
-- =====================================================================
alter policy "Nutzer verwalten eigene Favoriten" on public.favorites
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Nutzer können ihr eigenes Profil bearbeiten" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Nutzer verwalten eigene Fahrten" on public.route_completions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Nutzer verwalten eigene Bewertungen" on public.route_ratings
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Angemeldete Nutzer können Strecken vorschlagen" on public.routes
  with check ((erstellt_von = (select auth.uid())) and (status_ok = false));

alter policy "Freigegebene Strecken sind öffentlich lesbar" on public.routes
  using ((status_ok = true) or (erstellt_von = (select auth.uid())));

alter policy "Moderatoren können Strecken ablehnen (löschen)" on public.routes
  using (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_moderator = true
  ));

alter policy "Moderatoren können alle Strecken freischalten" on public.routes
  using (exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.is_moderator = true
  ));

alter policy "Moderatoren sehen auch unveröffentlichte, nicht-private Strecken" on public.routes
  using (
    ist_privat = false
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.is_moderator = true
    )
  );

alter policy "Nutzer können eigene abgelehnte Vorschläge löschen" on public.routes
  using ((erstellt_von = (select auth.uid())) and (abgelehnt_am is not null));

alter policy "Nutzer können eigene unverifizierte Strecken bearbeiten" on public.routes
  using ((erstellt_von = (select auth.uid())) and (status_ok = false));

alter policy "Nutzer verwalten eigene Fahrzeuge" on public.vehicles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =====================================================================
-- F) Zwei echte Datenlecks in den öffentlichen Leaderboard-/Foto-Views
--    (alle vier Views laufen bewusst mit den Rechten des View-Owners statt
--    des Aufrufers — sonst könnten anon/authenticated über die zugrunde-
--    liegende route_completions/profiles-RLS gar keine fremden Zeilen
--    sehen, was der ganze Zweck dieser öffentlichen Aggregations-Views ist.
--    Das ist weiterhin so gewollt, daher bleibt der security_definer_view-
--    Advisor-Hinweis nach diesem Fix bewusst bestehen):
--
-- F1) leaderboard_completions/route_leaderboard gaben rc.ist_premium immer
--     roh nach aussen, unabhängig vom Opt-in zeigt_premium_badge. Jeder
--     Client konnte also per direktem PostgREST-Request (select=ist_premium)
--     den Premium-Status eines Nutzers auslesen, selbst wenn dieser das
--     Premium-Abzeichen bewusst nicht öffentlich zeigen wollte. Server-
--     seitiges Gaten (statt dem Aufrufer zu vertrauen) ist bereits das
--     etablierte Muster in diesem Projekt für dieselben zwei Spalten, siehe
--     lib/profile.ts und lib/ratings.ts — hier wird es nur zusätzlich auf
--     Datenbankebene erzwungen.
-- F2) route_photos filterte nicht nach rc.ist_oeffentlich — Fotos aus nicht
--     öffentlich geteilten Fahrten waren dadurch für jeden über
--     lib/photos.ts (route_photos-Abfrage nach route_id, ohne weiteren
--     Filter) sichtbar, entgegen der in 0017_pro_fahrt_sichtbarkeit.sql
--     eingeführten Opt-in-Logik.
-- =====================================================================
create or replace view public.leaderboard_completions as
select
  rc.user_id,
  p.display_name,
  rc.route_id,
  r.laenge_km,
  r.hoehe_m,
  coalesce(rc.distanz_km, r.laenge_km) as effektive_distanz_km,
  (p.ist_premium and p.zeigt_premium_badge) as ist_premium,
  p.zeigt_premium_badge
from route_completions rc
  join profiles p on (p.id = rc.user_id)
  join routes r on (r.id = rc.route_id)
where r.status_ok = true and rc.ist_oeffentlich = true;

comment on view public.leaderboard_completions is
  'Öffentliches Leaderboard-Aggregat, läuft bewusst mit den Rechten des View-Owners (bypasst RLS auf route_completions/profiles) — das ist der Zweck dieser View, siehe 0013_leaderboard_view.sql. ist_premium wird hier bereits mit zeigt_premium_badge verrechnet ausgegeben, damit ein direkter PostgREST-Request nicht den rohen Premium-Status eines Nutzers offenlegt, der das Abzeichen nicht öffentlich zeigen möchte.';

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
  p.zeigt_premium_badge
from route_completions rc
  join profiles p on (p.id = rc.user_id)
where rc.ist_oeffentlich = true and rc.dauer_sekunden is not null;

comment on view public.route_leaderboard is
  'Pro-Strecke-Leaderboard, läuft bewusst mit den Rechten des View-Owners (bypasst RLS), siehe 0014_route_leaderboard_optin.sql. ist_premium ist wie bei leaderboard_completions bereits mit zeigt_premium_badge verrechnet.';

create or replace view public.route_photos as
select
  rc.id,
  rc.route_id,
  rc.foto_url,
  rc.datum,
  p.display_name
from route_completions rc
  join profiles p on (p.id = rc.user_id)
where rc.foto_url is not null and rc.ist_oeffentlich = true;

comment on view public.route_photos is
  'Fotos abgeschlossener Fahrten für die Streckenseite, läuft bewusst mit den Rechten des View-Owners (bypasst RLS). Filtert zusätzlich auf ist_oeffentlich = true, damit Fotos aus nicht öffentlich geteilten Fahrten (0017_pro_fahrt_sichtbarkeit.sql) nicht angezeigt werden — fehlte vor dieser Migration.';

-- =====================================================================
-- G) profiles: is_moderator, ist_premium und stripe_customer_id waren über
--    die Standard-Supabase-Spalten-Grants für anon/authenticated *lesbar
--    und beschreibbar* (letzteres über die RLS-Policy "Nutzer können ihr
--    eigenes Profil bearbeiten", die nur die Zeile prüft, nicht die
--    geänderten Spalten). Konkret hätte jeder eingeloggte Nutzer per
--    direktem PATCH auf /rest/v1/profiles sich selbst zum Moderator machen
--    oder sich Premium ohne Zahlung freischalten können — unabhängig von
--    der App-UI oder der Stripe-Verifikation in confirmSubscription.
--
--    is_moderator bleibt lesbar (wird von den Moderator-RLS-Policies oben
--    unter der aufrufenden Rolle ausgewertet und würde sonst für
--    Moderatoren selbst brechen), aber nicht mehr beschreibbar.
--    ist_premium bleibt aus demselben Grund lesbar (siehe lib/profile.ts,
--    lib/ratings.ts — öffentliche Premium-Badges für andere Nutzer), aber
--    nicht mehr beschreibbar.
--    stripe_customer_id braucht clientseitig nie lesbaren oder
--    schreibbaren Zugriff — wird nur noch serverseitig über den
--    Service-Role-Client gelesen/geschrieben (siehe lib/actions/billing.ts,
--    app/api/stripe/webhook/route.ts).
-- =====================================================================
revoke update (is_moderator, ist_premium, stripe_customer_id) on public.profiles from anon, authenticated;
revoke select (stripe_customer_id) on public.profiles from anon, authenticated;
