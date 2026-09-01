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

// Ab 0037_public_follows.sql — läuft über die public_follows-View (bewusster
// Bypass von follows' eigener RLS, die Dritten sonst keine Zeile zeigt),
// damit Zahlen/Listen auch auf einem fremden öffentlichen Profil sichtbar
// sind, nicht nur auf dem eigenen.
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const supabase = await createClient();
  const [followers, following] = await Promise.all([
    supabase
      .from("public_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", userId),
    supabase
      .from("public_follows")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function getFollowerProfiles(userId: string): Promise<FollowProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_follows")
    .select("follower_id, follower_display_name, follower_avatar_url")
    .eq("followed_id", userId);
  return (data ?? []).map((r) => ({
    id: r.follower_id,
    displayName: r.follower_display_name,
    avatarUrl: r.follower_avatar_url,
  }));
}

export async function getFollowingProfiles(userId: string): Promise<FollowProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_follows")
    .select("followed_id, followed_display_name, followed_avatar_url")
    .eq("follower_id", userId);
  return (data ?? []).map((r) => ({
    id: r.followed_id,
    displayName: r.followed_display_name,
    avatarUrl: r.followed_avatar_url,
  }));
}
