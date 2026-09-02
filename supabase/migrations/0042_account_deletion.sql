-- Konto löschen (Recht auf Löschung/DSGVO) — es gab bisher keinen Weg dazu:
-- app/profil/einstellungen/page.tsx enthielt laut eigenem Kommentar
-- "Abmelden [als] einzige echte Aktion im Konto-Bereich".
--
-- Der auth.users-Datensatz selbst wird hier bewusst NICHT über die
-- Admin-API gelöscht (admin.auth.admin.deleteUser). Fast jede Tabelle mit
-- User-Bezug referenziert auth.users(id) mit "on delete cascade"
-- (profiles: 0001, vehicles: 0001, route_completions: 0001,
-- route_ratings: 0001, kudos: 0029, follows: 0030, completion_photos:
-- 0036) — ein gelöschter Auth-User würde also automatisch sämtliche
-- Fahrten/Bewertungen/Kudos/Follows mitreissen. Das wäre genau das
-- Gegenteil des gewünschten Verhaltens: Fahrten/Bewertungen (und damit
-- Leaderboards/Statistiken) sollen erhalten bleiben, nur anonymisiert
-- (nur routes.erstellt_von ist ohnehin schon "on delete set null", 0001,
-- für den hier nicht gewählten Fall einer echten Auth-User-Löschung).
--
-- Stattdessen bleibt der auth.users-Datensatz bestehen (die UUID ist reine,
-- nicht für sich genommen personenbezogene Fremdschlüssel-Klammer), aber:
--  1) das öffentliche Profil wird hier anonymisiert (Name, Avatar, alle
--     Sichtbarkeits-Opt-ins aus, Moderator-/Premium-Flags zurückgesetzt) —
--     siehe anonymize_own_account() unten,
--  2) eigene Fahrzeuge werden gelöscht (reine Ausstattungsdaten, anders als
--     Fahrten/Bewertungen nicht community-relevant),
--  3) E-Mail und Passwort werden serverseitig über den Admin-Client
--     entwertet (lib/actions/auth.ts, deleteAccount) — das eigentliche
--     "Löschen" der Zugangs-PII, siehe dort für die Begründung, warum das
--     dort (Admin-Client) statt hier (SQL) passiert.
--
-- SECURITY DEFINER ist hier nötig, weil 0034 den authenticated-UPDATE-Grant
-- auf profiles bewusst auf eine feste Spaltenliste ohne display_name/
-- is_moderator/ist_premium/zeigt_follower_liste beschränkt hat — genau um
-- willkürliche Selbst-Updates dieser Spalten durch einen normalen
-- authentifizierten Client zu verhindern. Diese Funktion umgeht das gezielt
-- nur für den eigenen, über auth.uid() gebundenen Account (kann nicht mit
-- einer fremden user_id aufgerufen werden, da auth.uid() nicht vom Aufrufer
-- beeinflussbar ist) und schreibt ausschliesslich den hier fest codierten,
-- harmlosen Anonymisierungs-Zustand — keine beliebige Werteingabe.
create or replace function public.anonymize_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set
    display_name = 'Gelöschtes Konto',
    avatar_url = null,
    zeigt_fahrzeuge = false,
    zeigt_avatar = false,
    zeigt_paesse = false,
    zeigt_hoehenmeter = false,
    zeigt_distanz = false,
    zeigt_follower_liste = false,
    zeigt_premium_badge = false,
    is_moderator = false,
    ist_premium = false
  where id = auth.uid();

  delete from public.vehicles where user_id = auth.uid();
end;
$$;

grant execute on function public.anonymize_own_account() to authenticated;
