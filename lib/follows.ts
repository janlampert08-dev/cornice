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
