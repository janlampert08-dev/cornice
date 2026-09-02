-- Follower-/Following-ZAHLEN bleiben laut expliziter Entscheidung in
-- 0037_public_follows.sql immer für jeden sichtbar — das ändert sich hier
-- nicht (getFollowCounts, lib/follows.ts, weiterhin ungefiltert über
-- public_follows).
--
-- Neu ist ein Opt-in für die dahinterliegende LISTE (welche Namen genau
-- folgen/gefolgt werden): ein einzelner Schalter für Follower- UND
-- Following-Liste zusammen, analog zu den übrigen granularen
-- Profileinstellungen (0018_granulare_profil_sichtbarkeit.sql).
--
-- Verhaltensänderung für Bestandsnutzer: ihre Listen waren bisher (0037)
-- ausnahmslos öffentlich einsehbar. Ab dieser Migration ist die Liste
-- standardmässig ausgeblendet (default false) — konsistent mit "alles aus"
-- bei allen übrigen zeigt_*-Schaltern, aber ein bewusster Teil-Rückzug von
-- der 0037-Prämisse "kein Opt-out für Dritte". Nur die Zahl bleibt wie
-- gehabt ausnahmslos sichtbar; die Anwendungslogik (app/fahrer/[id]/
-- page.tsx) zeigt dem Profil-Besitzer selbst seine eigene Liste unabhängig
-- von diesem Flag immer vollständig.
alter table public.profiles
  add column zeigt_follower_liste boolean not null default false;

comment on column public.profiles.zeigt_follower_liste is
  'Opt-in: eigene Follower-/Following-LISTE (Namen, ueber public_follows) fuer andere Betrachter sichtbar. Die Zahlen selbst (getFollowCounts) bleiben davon unabhaengig immer sichtbar (0037_public_follows.sql, hier bewusst unveraendert). Dem Besitzer selbst zeigt die App seine eigene Liste unabhaengig von diesem Flag immer vollstaendig (Anwendungslogik, nicht RLS).';

-- Granulare Spalten-Grants wie 0034_profiles_column_grant_hardening.sql —
-- additiv zur dortigen Liste (GRANT auf eine einzelne Spalte erweitert die
-- bestehenden column-level Grants, ersetzt sie nicht), ergänzt nur die neue
-- Spalte statt die gesamte Liste dort erneut zu schreiben.
grant select (zeigt_follower_liste) on public.profiles to anon, authenticated;
grant update (zeigt_follower_liste) on public.profiles to authenticated;
