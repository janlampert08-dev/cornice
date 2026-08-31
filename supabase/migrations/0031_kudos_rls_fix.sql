-- Behebt einen echten Bug in den kudos-RLS-Policies aus 0029_kudos.sql:
-- Kudos auf die Fahrt eines ANDEREN Nutzers zu geben (bzw. anzusehen)
-- schlug bisher für praktisch jeden fehl.
--
-- Ursache: die INSERT/SELECT-Policies auf public.kudos prüften per
-- Subquery direkt gegen public.route_completions, ob die Ziel-Fahrt
-- öffentlich ist:
--   exists (select 1 from route_completions rc where rc.id = ... and
--           rc.ist_oeffentlich = true)
-- RLS-Policies laufen aber mit den Rechten des ausführenden Nutzers, nicht
-- des Migrations-Autors — und route_completions erlaubt laut
-- 0001_init.sql per SELECT-Policy ausschliesslich dem Fahrten-Besitzer
-- selbst, seine eigenen Zeilen zu lesen ("auth.uid() = user_id"). Für
-- jeden ANDEREN Nutzer liefert die Subquery deshalb immer 0 Zeilen —
-- unabhängig vom tatsächlichen ist_oeffentlich-Wert —, wodurch die
-- WITH-CHECK-Bedingung beim Insert fehlschlägt bzw. die Kudos-Zeile beim
-- Select unsichtbar bleibt. Das betraf exakt den Hauptfall (Kudos auf die
-- Fahrt eines anderen Nutzers geben/sehen), nicht aber die serverseitig
-- über die View kudos_summary berechnete Zähl-Anzeige (Views laufen mit
-- den Rechten ihres Owners, nicht des abfragenden Nutzers — deshalb zeigte
-- die Zahl selbst schon korrekt an, nur das Geben/Zurücknehmen und der
-- eigene "schon gegeben"-Zustand nicht).
--
-- Fix: dieselbe "ist diese Fahrt öffentlich"-Prüfung in eine SECURITY
-- DEFINER-Funktion ausgelagert, die mit den Rechten ihres Owners läuft und
-- damit RLS auf route_completions umgeht — exakt dasselbe kontrollierte
-- Bypass-Muster, das public_fahrten/route_leaderboard (als Views) schon
-- nutzen, hier nur als Funktion für den Einsatz innerhalb einer
-- RLS-Policy. Gibt ausschliesslich einen Boolean zurück, keine
-- Fahrt-Rohdaten — kein breiterer Zugriff als vorher beabsichtigt.
create or replace function public.completion_is_public(p_completion_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.route_completions rc
    where rc.id = p_completion_id and rc.ist_oeffentlich = true
  );
$$;

revoke execute on function public.completion_is_public(uuid) from public;
grant execute on function public.completion_is_public(uuid) to anon, authenticated;

drop policy if exists "Kudos auf öffentlichen Fahrten sind sichtbar" on public.kudos;
create policy "Kudos auf öffentlichen Fahrten sind sichtbar"
  on public.kudos for select
  using (public.completion_is_public(completion_id));

drop policy if exists "Nutzer geben Kudos nur auf öffentliche Fahrten" on public.kudos;
create policy "Nutzer geben Kudos nur auf öffentliche Fahrten"
  on public.kudos for insert
  with check (auth.uid() = user_id and public.completion_is_public(completion_id));

comment on function public.completion_is_public(uuid) is
  'SECURITY DEFINER, da route_completions per RLS nur dem Fahrten-Besitzer selbst sichtbar ist — für die kudos-Policies (Kudos auf FREMDE öffentliche Fahrten geben/sehen) muss die Öffentlich-Prüfung mit erhöhten Rechten laufen, gibt aber ausschliesslich einen Boolean zurück, keine Fahrt-Rohdaten.';
