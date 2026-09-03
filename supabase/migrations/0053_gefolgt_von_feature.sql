-- "Gefolgt von ..." — dezenter Hinweis auf einem fremden Profil, welche der
-- Personen, denen der Betrachter selbst folgt, ihrerseits diesem Profil
-- folgen (wie Instagrams "Followed by X, Y and Z others"). Baut auf
-- follows (0030) und dem get_follower_list/get_follow_counts-Muster aus
-- 0040_follower_liste_view_lockdown.sql auf.
--
-- Sicherheitsüberlegung: die Funktion nimmt einen p_viewer_id-Parameter
-- entgegen statt sich wie get_follower_list allein auf auth.uid() als
-- Betrachter zu verlassen — der Schnittmengen-Charakter des Ergebnisses
-- (wen der Betrachter selbst folgt UND wer dem Profil folgt) würde sonst
-- erlauben, mit beliebigen p_viewer_id-Werten fremde Folge-Graphen
-- auszulesen. Deshalb: die WHERE-Klausel erzwingt auth.uid() = p_viewer_id
-- explizit als Teil der Funktion selbst (SECURITY DEFINER umgeht RLS, die
-- Freigabeentscheidung muss also hier stehen, nicht beim Aufrufer — analog
-- AGENTS.md "RLS ist eine Sicherheitsgrenze, keine Formalität").
--
-- Privatsphäre des Profil-Besitzers: das Ergebnis verrät zwangsläufig einen
-- Teil von dessen Follower-Liste (nämlich die Schnittmenge mit den vom
-- Betrachter bereits gefolgten Personen). Das respektiert deshalb dieselbe
-- zeigt_follower_liste-Einstellung wie get_follower_list (0039/0040) statt
-- eine neue, stillschweigend abweichende Sichtbarkeitsregel einzuführen
-- (AGENTS.md Regel 16) — mit derselben Owner-Ausnahme (auth.uid() =
-- p_profile_id sieht immer alles).
--
-- total_count via count(*) over() auf der ungekürzten Schnittmenge, damit
-- die Anwendung "und N weitere" anzeigen kann, ohne eine zweite Abfrage zu
-- brauchen; das eigentliche LIMIT (Vorschau, standardmässig 3 wie Instagram)
-- greift erst in der äusseren SELECT.
create or replace function public.get_mutual_followers(
  p_viewer_id uuid,
  p_profile_id uuid,
  p_limit integer default 3
)
returns table(id uuid, display_name text, avatar_url text, total_count integer)
language sql
security definer
set search_path = public
stable
as $$
  with mutuals as (
    select
      p.id,
      p.display_name,
      case when p.zeigt_avatar then p.avatar_url else null end as avatar_url
    from public.follows viewer_follows
    join public.follows target_followers
      on target_followers.follower_id = viewer_follows.followed_id
     and target_followers.followed_id = p_profile_id
    join public.profiles p on p.id = viewer_follows.followed_id
    where viewer_follows.follower_id = p_viewer_id
      and auth.uid() = p_viewer_id
      and p_viewer_id <> p_profile_id
      and (
        auth.uid() = p_profile_id
        or exists (
          select 1 from public.profiles pt
          where pt.id = p_profile_id and pt.zeigt_follower_liste
        )
      )
  ),
  counted as (
    select *, count(*) over ()::integer as total_count from mutuals
  )
  select id, display_name, avatar_url, total_count
  from counted
  order by display_name nulls last, id
  limit greatest(p_limit, 0);
$$;

comment on function public.get_mutual_followers(uuid, uuid, integer) is
  '"Gefolgt von ..."-Vorschau: Schnittmenge aus (wem p_viewer_id folgt) und (wer p_profile_id folgt), samt total_count der vollstaendigen Schnittmenge. auth.uid() = p_viewer_id wird in der Funktion selbst erzwungen (siehe Kommentar oben) -- ohne diese Bindung liesse sich mit beliebigen p_viewer_id-Werten fremder Folge-Graph erschliessen. Respektiert zeigt_follower_liste des Zielprofils wie get_follower_list, mit derselben Owner-Ausnahme.';

-- Nur authenticated: ein anonymer Aufrufer hat kein auth.uid(), die
-- auth.uid() = p_viewer_id-Bedingung liefert dafuer ohnehin immer leer.
grant execute on function public.get_mutual_followers(uuid, uuid, integer) to authenticated;
