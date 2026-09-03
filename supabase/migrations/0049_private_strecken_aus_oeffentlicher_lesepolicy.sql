-- Verankert die Privatsphäre privater Strecken in der RLS-Policy statt nur in
-- den Schreibpfaden der Anwendung.
--
-- Bisher lautete die öffentliche Lese-Policy auf public.routes:
--
--   using (status_ok = true or erstellt_von = auth.uid())
--
-- ist_privat kam darin nicht vor. Eine Strecke mit ist_privat = true *und*
-- status_ok = true wäre damit für jeden lesbar gewesen — inklusive ihrer
-- vollständigen Geometrie über die View routes_geojson (security_invoker,
-- erbt also genau diese Policy). Nachgestellt und bestätigt: ein fremder,
-- angemeldeter Nutzer bekam eine so gesetzte Zeile zurück.
--
-- Diese Kombination entsteht heute über keinen erreichbaren Pfad:
--
--   * propose_route_full setzt status_ok immer auf false;
--   * die INSERT-Policy erzwingt status_ok = false zusätzlich;
--   * die Besitzer-UPDATE-Policy hat kein eigenes with check und fällt damit
--     auf ihr using zurück (erstellt_von = auth.uid() and status_ok = false),
--     ein Selbst-Freischalten scheitert also an der Policy — überprüft, die
--     Datenbank antwortet mit 42501;
--   * Moderatoren sehen private Strecken gar nicht (ihre SELECT-Policy
--     verlangt ist_privat = false), ein update trifft dort null Zeilen.
--
-- Die Sicherheitseigenschaft hing damit vollständig daran, dass *jeder*
-- künftige Schreibpfad diese Invariante mitdenkt. Genau das soll RLS nicht
-- sein (siehe AGENTS.md, "Supabase Rules"): die Grenze gehört in die Policy.
--
-- Verhalten für die bestehenden Daten unverändert — nachgemessen: ein fremder
-- Nutzer sieht vorher wie nachher genau die 7 freigegebenen, nicht-privaten
-- Strecken; der Besitzer sieht seine eigene private Strecke weiterhin über
-- den zweiten Zweig (erstellt_von = auth.uid()).

drop policy "Freigegebene Strecken sind öffentlich lesbar" on public.routes;

create policy "Freigegebene Strecken sind öffentlich lesbar"
  on public.routes for select
  using (
    (status_ok = true and ist_privat = false)
    or erstellt_von = (select auth.uid())
  );

-- Die Moderatoren-UPDATE-Policy bleibt bewusst unangetastet: sie ohne
-- with check zu lassen ist hier folgenlos, weil eine private Strecke für
-- Moderatoren schon nicht lesbar ist und ein UPDATE mit WHERE-Klausel
-- deshalb null Zeilen trifft (nachgestellt). Ein zusätzliches
-- with check (ist_privat = false) würde keinen erreichbaren Weg schliessen
-- und in einer Protected Area nur Risiko ohne Nutzen hinzufügen.
