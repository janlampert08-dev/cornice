-- Minimaler Rückkanal für "Community reagiert" im Kernloop (siehe AGENTS.md,
-- Abschnitt "Core User Loop", Schritt 7→8): bisher gab es kein Signal an den
-- Fahrer, dass eine geteilte Fahrt Kudos bekommen hat — nur ein zufälliger
-- erneuter Besuch der eigenen Fahrt-Seite hätte es gezeigt. Kein volles
-- Notifications-System (eigene Tabelle, Trigger, Push) — nur ein
-- "zuletzt gesehen"-Zeitpunkt, aus dem sich "wie viele Kudos seit dem
-- letzten Mal" ableiten lässt (siehe lib/kudos.ts, count_unseen_kudos unten).

-- default now() sorgt dafür, dass Bestandsnutzer beim Anwenden dieser
-- Migration nicht plötzlich Dutzende "neue" Kudos aus ihrer gesamten
-- Historie angezeigt bekommen — der Zähler startet bei null und wächst erst
-- ab jetzt.
alter table public.profiles
  add column kudos_gesehen_am timestamptz not null default now();

comment on column public.profiles.kudos_gesehen_am is
  'Zeitpunkt, zu dem der Nutzer zuletzt seine eigenen Kudos-Reaktionen gesehen hat. Bewusst kein Spalten-Grant an authenticated (anders als privatzone_radius_m/zeigt_follower_liste) -- die SELECT-Policy auf profiles ist zeilenoffen ("using (true)"), ein Grant würde also jedem eingeloggten Nutzer per direktem PostgREST-Request verraten, wann ein beliebiger anderer Nutzer zuletzt sein Profil besucht hat. Nur über count_unseen_kudos()/mark_kudos_seen() gelesen bzw. geschrieben, beide auf auth.uid() beschränkt.';

-- Zählt Kudos auf den eigenen Fahrten seit kudos_gesehen_am. SECURITY
-- DEFINER aus zwei Gründen: (1) liest kudos_gesehen_am, ohne dafür einen
-- Spalten-Grant zu vergeben (siehe Kommentar oben), und (2) ein normaler
-- authenticated-Client könnte den nötigen Join zwischen kudos und
-- route_completions ohnehin nicht als einzelne Aggregat-Abfrage über
-- PostgREST ausdrücken. Nimmt keine Parameter entgegen und arbeitet
-- ausschliesslich mit auth.uid() -- kann nicht für einen anderen Nutzer
-- aufgerufen werden.
create function public.count_unseen_kudos()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from public.kudos k
  join public.route_completions rc on rc.id = k.completion_id
  where rc.user_id = auth.uid()
    and k.erstellt_am > (
      select p.kudos_gesehen_am from public.profiles p where p.id = auth.uid()
    );
$$;

comment on function public.count_unseen_kudos() is
  'Anzahl Kudos auf den eigenen Fahrten seit profiles.kudos_gesehen_am. Nur fuer auth.uid() selbst, siehe Kommentar oben.';

revoke execute on function public.count_unseen_kudos() from public;
revoke execute on function public.count_unseen_kudos() from anon;
grant execute on function public.count_unseen_kudos() to authenticated;

-- Setzt kudos_gesehen_am auf jetzt -- aufgerufen, sobald der Nutzer sein
-- eigenes Profil (mit den eigenen Fahrten) ansieht (app/profil/page.tsx).
-- Gleiches Muster wie anonymize_own_account() (0042_account_deletion.sql):
-- schreibt ausschliesslich einen fest codierten, harmlosen Wert (den
-- aktuellen Zeitstempel) in die eigene, über auth.uid() gebundene Zeile --
-- keine beliebige Werteingabe, kann nicht für einen anderen Nutzer
-- aufgerufen werden.
create function public.mark_kudos_seen()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles set kudos_gesehen_am = now() where id = auth.uid();
end;
$$;

comment on function public.mark_kudos_seen() is
  'Markiert die eigenen Kudos-Reaktionen als gesehen (setzt profiles.kudos_gesehen_am = now()). Nur fuer auth.uid() selbst, siehe Kommentar oben.';

revoke execute on function public.mark_kudos_seen() from public;
revoke execute on function public.mark_kudos_seen() from anon;
grant execute on function public.mark_kudos_seen() to authenticated;
