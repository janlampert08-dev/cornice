-- Zieht die EXECUTE-Rechte, die PostgreSQL beim CREATE FUNCTION automatisch
-- an PUBLIC vergibt, für die Funktionen zurück, die niemand direkt aufrufen
-- soll.
--
-- Hintergrund / warum das hier noch einmal steht:
-- 0027_security_performance_hardening.sql (Abschnitt B) wollte genau das
-- schon einmal, hat aber gegen den falschen Grantee gearbeitet:
--
--   revoke execute on function ... from anon, authenticated;
--
-- anon und authenticated hatten nie ein *eigenes* EXECUTE-Recht auf diesen
-- Funktionen — sie erben es von PUBLIC. Ein REVOKE gegen einen Grantee ohne
-- direkte Berechtigung ist in PostgreSQL kein Fehler, sondern eine stille
-- No-Op (nur eine WARNING). Die Migration lief also erfolgreich durch, ohne
-- irgendetwas zu bewirken — nachweisbar daran, dass die Supabase-Advisors
-- weiterhin "Public Can Execute SECURITY DEFINER Function" für dieselben
-- Funktionen melden und has_function_privilege('anon', ..., 'EXECUTE')
-- unverändert true liefert.
--
-- Deshalb: revoke ... from public. Der Funktionseigentümer (postgres) und
-- service_role behalten ihr Recht über die Ownership bzw. ihre eigenen
-- Grants; nur der geerbte Weg über PUBLIC fällt weg.

-- =====================================================================
-- A) Reine Trigger-Funktionen. Trigger feuern unabhängig von EXECUTE-
--    Rechten weiter (PostgreSQL prüft beim Auslösen eines Triggers keine
--    EXECUTE-Berechtigung auf der Trigger-Funktion) — der Entzug schliesst
--    also nur den unnötigen direkten Aufrufweg, ohne die Cooldowns, das
--    Fotolimit oder das Anlegen des Profils bei der Registrierung
--    anzutasten.
-- =====================================================================
revoke execute on function public.enforce_completion_cooldown() from public;
revoke execute on function public.enforce_rating_cooldown() from public;
revoke execute on function public.enforce_route_proposal_cooldown() from public;
revoke execute on function public.enforce_completion_photo_limit() from public;
revoke execute on function public.handle_new_user() from public;

-- =====================================================================
-- B) Kontolöschung: soll ausschliesslich angemeldeten Nutzern offenstehen.
--    Die Funktion prüft zwar selbst auf auth.uid() is null und wirft dann
--    (0042/0045), aber ein anonym aufrufbarer /rest/v1/rpc-Endpunkt, der
--    fremde Daten anonymisieren *würde*, wenn diese eine Prüfung fiele, ist
--    unnötiges Risiko. Der explizite Grant an authenticated aus 0045 bleibt
--    bestehen und wird hier zur Sicherheit noch einmal gesetzt.
-- =====================================================================
revoke execute on function public.anonymize_own_account() from public;
grant execute on function public.anonymize_own_account() to authenticated;

-- Bewusst NICHT angefasst:
--
-- * completion_is_public, get_follow_counts, get_follower_list,
--   get_following_list — die öffentlichen Profil- und Feed-Seiten rufen sie
--   ohne Anmeldung auf. Sie liefern nur Daten, die ohnehin öffentlich sind
--   (siehe 0037/0039/0040).
-- * propose_route/propose_route_full — SECURITY INVOKER, laufen also mit den
--   Rechten des Aufrufers und stossen bei anon auf die RLS-Policies von
--   routes. Ein Rechteentzug wäre hier zusätzliche Tiefe, aber auch ein
--   Eingriff in den Vorschlagspfad; das gehört in eine eigene Änderung.
-- * public.spatial_ref_sys — die PostGIS-Referenztabelle gehört
--   supabase_admin, nicht postgres. Weder "alter table ... enable row level
--   security" (Fehler 42501: must be owner of table) noch ein REVOKE der
--   Schreibrechte von anon/authenticated (wieder eine stille No-Op, weil der
--   Grantor supabase_admin ist) sind aus einer Migration heraus möglich.
--   0027 Abschnitt A behauptete das Gegenteil und ist deshalb wirkungslos
--   geblieben. Siehe PR-Beschreibung — das braucht Supabase-Support.
