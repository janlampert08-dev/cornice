import { createClient } from "@/lib/supabase/server";

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  return data !== null;
}

// Für den "Folge ich"-Filter im Feed (lib/feed.ts) — eine einzige Query
// statt einer pro Fahrt/Nutzer.
export async function getFollowedUserIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("followed_id").eq("follower_id", userId);
  return (data ?? []).map((r) => r.followed_id);
}

export interface FollowCounts {
  followers: number;
  following: number;
}

export interface FollowProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// Ab 0037_public_follows.sql, gehärtet in 0040_follower_liste_view_lockdown.sql:
// public_follows selbst ist nicht mehr direkt an anon/authenticated gegrantet
// (wäre sonst per PostgREST direkt abfragbar und würde zeigt_follower_liste
// aus 0039 komplett umgehen) — Zahlen und Listen laufen jetzt über
// SECURITY-DEFINER-Funktionen, die die Sichtbarkeitsregel serverseitig
// durchsetzen statt sie dem Aufrufer (dieser Seite) zu überlassen.
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_follow_counts", { p_user_id: userId }).single();
  return { followers: data?.followers ?? 0, following: data?.following ?? 0 };
}

export async function getFollowerProfiles(userId: string): Promise<FollowProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_follower_list", { p_user_id: userId });
  return (data ?? []).map((r) => ({
    id: r.follower_id,
    displayName: r.follower_display_name,
    avatarUrl: r.follower_avatar_url,
  }));
}

export async function getFollowingProfiles(userId: string): Promise<FollowProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_following_list", { p_user_id: userId });
  return (data ?? []).map((r) => ({
    id: r.followed_id,
    displayName: r.followed_display_name,
    avatarUrl: r.followed_avatar_url,
  }));
}
