-- Nachtrag zu 0047: dort wurden die EXECUTE-Rechte nur von PUBLIC entzogen.
-- Zwei der sechs Funktionen tragen zusätzlich *direkte* Grants an anon und
-- authenticated (Grantor postgres, aus den default privileges, die beim
-- Anlegen der Funktion galten):
--
--   anonymize_own_account          -> anon, authenticated
--   enforce_completion_photo_limit -> anon, authenticated
--
-- Ein direkter Grant überlebt das REVOKE gegen PUBLIC — nach 0047 blieb
-- has_function_privilege('anon', ..., 'EXECUTE') für genau diese beiden
-- true, während die übrigen vier korrekt auf false gingen. Hier fehlt also
-- der zweite Halbsatz. (0047 bleibt unangetastet: eine eingespielte
-- Migration wird nicht nachträglich verändert, siehe AGENTS.md.)
--
-- Merksatz für künftige Rechteänderungen: ein REVOKE wirkt nur gegen den
-- Grantee, der die Berechtigung tatsächlich hält. Wer nicht weiss, woher
-- ein Recht kommt, schaut es vorher in aclexplode(proacl) nach — ein REVOKE
-- gegen den falschen Grantee ist kein Fehler, sondern eine stille No-Op.

revoke execute on function public.enforce_completion_photo_limit() from anon, authenticated;

revoke execute on function public.anonymize_own_account() from anon;
-- authenticated behält den Zugang bewusst: das ist der Pfad der
-- Kontolöschung aus den Einstellungen (0042/0045).
grant execute on function public.anonymize_own_account() to authenticated;
