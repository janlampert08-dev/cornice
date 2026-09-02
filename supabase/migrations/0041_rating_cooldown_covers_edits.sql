-- Bug: der Rating-Cooldown (0024) prüft/erzwingt nur bei INSERT. submitRating
-- (lib/actions/ratings.ts) macht aber einen upsert(... , {onConflict:
-- "route_id,user_id"}) — bewertet ein Nutzer eine Strecke, die er bereits
-- bewertet hat, erneut (Kommentar bearbeiten), wird daraus ein UPDATE, nicht
-- ein INSERT. Der "before insert"-Trigger feuert dann gar nicht, und
-- erstellt_am (nicht Teil der upsert-Spaltenliste) bleibt unverändert — damit
-- greift weder die DB-seitige Durchsetzung noch (weil isRateLimited denselben
-- unveränderten erstellt_am-Wert liest) der App-seitige Vorab-Check. Ein
-- Nutzer kann seinen eigenen Kommentar beliebig oft in schneller Folge
-- editieren, ohne dass der Anti-Spam-Cooldown je greift.
--
-- Fix: Trigger feuert jetzt zusätzlich "before update" und setzt
-- new.erstellt_am bei jedem erfolgreichen Schreibvorgang (Insert wie Update)
-- auf now() — die Spalte dient hier ohnehin als "letzte Aktivität für den
-- Cooldown", nicht als reines "erstellt am"-Feld (sie wird nirgends im UI als
-- Erstellungsdatum angezeigt, siehe components/RatingSection.tsx und
-- lib/ratings.ts — nur zur Sortierung genutzt). Ein bearbeiteter Kommentar
-- rückt dadurch in "neueste zuerst"-Sortierungen entsprechend nach oben, was
-- für einen editierten Beitrag ein sinnvolles Verhalten ist.
create or replace function public.enforce_rating_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(2, hashtext(new.user_id::text));

  -- Prüft weiterhin pauschal gegen die letzte Bewertungs-Aktivität (Insert
  -- ODER Edit) des Nutzers, unabhängig von der Strecke — bei einem Update
  -- ist die betroffene Zeile selbst Teil dieser Prüfung (ihr alter
  -- erstellt_am-Wert, da wir hier vor dem eigentlichen Schreiben stehen),
  -- wodurch auch wiederholtes Editieren desselben Kommentars erfasst wird.
  if exists (
    select 1 from public.route_ratings
    where user_id = new.user_id
      and erstellt_am > now() - interval '3 seconds'
  ) then
    raise exception 'cooldown_active';
  end if;

  new.erstellt_am := now();
  return new;
end;
$$;

drop trigger if exists route_ratings_cooldown on public.route_ratings;
create trigger route_ratings_cooldown
  before insert or update on public.route_ratings
  for each row execute procedure public.enforce_rating_cooldown();
