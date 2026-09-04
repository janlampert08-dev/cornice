-- Auf ausdrücklichen Produktentscheid: die granularen Sichtbarkeits-Opt-ins
-- (0015/0018/0039) starten ab jetzt standardmässig AN statt AUS. Das kehrt
-- bewusst die bisherige "alles aus, Nutzer schaltet einzeln frei"-Prämisse
-- um, siehe AGENTS.md Regel 16 — daher hier explizit benannt statt
-- stillschweigend nebenbei geändert.
--
-- Nur `set default` für künftige Zeilen (neue Registrierungen). Bestehende
-- Nutzer, die aktiv "aus" gewählt haben (oder die bewusste Opt-out-Wahl aus
-- 0039_follower_liste_privacy.sql für die Follower-Liste), behalten ihre
-- gespeicherte Einstellung unverändert — ein Massen-UPDATE würde bereits
-- getroffene Entscheidungen überschreiben, was Regel 16 gerade vermeiden
-- soll.
alter table public.profiles
  alter column zeigt_fahrzeuge set default true,
  alter column zeigt_avatar set default true,
  alter column zeigt_paesse set default true,
  alter column zeigt_hoehenmeter set default true,
  alter column zeigt_distanz set default true,
  alter column zeigt_follower_liste set default true;
