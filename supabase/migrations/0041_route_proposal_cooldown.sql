-- proposeRoute (lib/actions/routes.ts) hat bislang keinen Cooldown, obwohl
-- jeder Vorschlag externe API-Aufrufe auslöst: Reverse-Geocoding
-- (deriveRouteLocations) und das swisstopo-Höhenprofil (fetchElevationProfile
-- in lib/elevation.ts) — swisstopo dokumentiert ein Fair-Use-Limit von ca.
-- 20 Requests/Minute. Ein angemeldeter Nutzer, der per Skript wiederholt
-- Vorschläge einreicht, könnte dieses Limit für die ganze Anwendung
-- ausschöpfen (alle Nutzer teilen sich denselben Server-seitigen API-Key)
-- und zusätzlich die Moderationswarteschlange mit Spam fluten.
--
-- Gleiches Muster wie route_completions (0024) und route_ratings (0024,
-- 0041_rating_cooldown_covers_edits): App-seitiger Vorab-Check in
-- lib/rateLimit.ts für schnelles Nutzer-Feedback, plus race-freie
-- Durchsetzung hier per BEFORE-INSERT-Trigger + Advisory-Lock. Der Trigger
-- greift unabhängig davon, dass Inserts über die propose_route_full()-RPC
-- laufen (0006/0033) statt über ein direktes INSERT — Trigger auf der
-- Zieltabelle feuern in Postgres unabhängig vom Aufrufpfad.
--
-- Grosszügigeres Zeitfenster als bei Bewertungen/Fahrten (15s statt 3-5s):
-- eine Streckenvorschlag braucht ohnehin mehrere Sekunden Formular-
-- Interaktion (Route auf der Karte einzeichnen, Name/Kategorien wählen),
-- der Cooldown soll nur Skript-Missbrauch bremsen, nicht gelegentliche
-- schnelle Mehrfach-Vorschläge legitimer Nutzer stören.
create or replace function public.enforce_route_proposal_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(3, hashtext(new.erstellt_von::text));

  if new.erstellt_von is not null and exists (
    select 1 from public.routes
    where erstellt_von = new.erstellt_von
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'cooldown_active';
  end if;

  return new;
end;
$$;

drop trigger if exists routes_proposal_cooldown on public.routes;
create trigger routes_proposal_cooldown
  before insert on public.routes
  for each row execute procedure public.enforce_route_proposal_cooldown();
