-- Abgelehnte Streckenvorschläge sammeln sich sonst dauerhaft an: Nutzer
-- können sie zwar schon selbst löschen (0012_eigene_abgelehnte_loeschen.sql),
-- tun das aber oft nicht. Ein täglicher pg_cron-Job räumt sie deshalb 3 Tage
-- nach der Ablehnung automatisch weg.

create extension if not exists pg_cron;

-- Kein SECURITY DEFINER: der pg_cron-Job ruft die Funktion als die Rolle
-- auf, die ihn registriert (hier: postgres, siehe cron.schedule() unten).
-- postgres besitzt die Tabelle und umgeht RLS damit ohnehin wie gewohnt.
create or replace function public.delete_alte_abgelehnte_vorschlaege()
returns void
language sql
set search_path = public
as $$
  delete from public.routes
  where abgelehnt_am is not null
    and abgelehnt_am < now() - interval '3 days';
$$;

comment on function public.delete_alte_abgelehnte_vorschlaege() is
  'Löscht Streckenvorschläge, die seit mehr als 3 Tagen abgelehnt sind (abgelehnt_am). Wird täglich per pg_cron aufgerufen, siehe cron.job "abgelehnte-vorschlaege-loeschen".';

-- Neu erstellte Funktionen sind per Default für PUBLIC ausführbar (siehe
-- 0047/0048) — diese hier ist reine interne Wartungslogik für den
-- Cron-Job, kein API-Endpunkt für Clients.
revoke execute on function public.delete_alte_abgelehnte_vorschlaege() from public;
revoke execute on function public.delete_alte_abgelehnte_vorschlaege() from anon, authenticated;

-- cron.schedule() mit einem bereits vergebenen Job-Namen aktualisiert den
-- bestehenden Job (Upsert), statt ihn zu duplizieren — die Migration bleibt
-- damit erneut anwendbar. Täglich um 03:00 UTC.
select cron.schedule(
  'abgelehnte-vorschlaege-loeschen',
  '0 3 * * *',
  $$select public.delete_alte_abgelehnte_vorschlaege();$$
);
