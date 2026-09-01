-- follows (0030_follows_and_feed.sql) erlaubt bewusst KEIN öffentliches
-- Folge-Verzeichnis: RLS lässt nur die zwei beteiligten Parteien einer Kante
-- die eigene Zeile sehen ("kein öffentliches Folge-Verzeichnis für Dritte").
-- Produktentscheid (siehe Plan): Follower/Following-Zahlen und -Listen sollen
-- neu auch auf einem FREMDEN öffentlichen Profil sichtbar sein — bewusste,
-- explizit bestätigte Erweiterung dieser bisherigen Einschränkung, nicht nur
-- fürs eigene Profil.
--
-- Gleiches Bypass-Prinzip wie public_fahrten/route_photos: eine View statt
-- einer RLS-Lockerung auf der Basistabelle selbst — follows.select bleibt
-- für Dritte weiterhin gesperrt, nur diese View (mit den Rechten ihres
-- Owners) macht Name+Avatar beider Seiten einer Kante nach aussen sichtbar.
-- avatar_url respektiert wie überall zeigt_avatar (0015).
create view public.public_follows as
select
  f.follower_id,
  f.followed_id,
  pf.display_name as follower_display_name,
  case when pf.zeigt_avatar then pf.avatar_url else null end as follower_avatar_url,
  pd.display_name as followed_display_name,
  case when pd.zeigt_avatar then pd.avatar_url else null end as followed_avatar_url
from public.follows f
join public.profiles pf on pf.id = f.follower_id
join public.profiles pd on pd.id = f.followed_id;

comment on view public.public_follows is
  'Follower/Following-Zahlen und -Listen für Profile (eigenes und fremde öffentliche), läuft bewusst mit den Rechten des View-Owners (bypasst RLS auf follows). Bewusste Erweiterung von 0030_follows_and_feed.sql, das für die Basistabelle selbst explizit kein öffentliches Verzeichnis vorsah — siehe 0037_public_follows.sql.';

grant select on public.public_follows to anon, authenticated;
