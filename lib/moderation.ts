import { createClient } from "@/lib/supabase/server";
import type { Route } from "@/types/database";

export async function isModerator(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_moderator ?? false;
}

export async function getPendingRoutes(): Promise<Route[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("routes")
    .select("*")
    .eq("status_ok", false)
    .eq("ist_privat", false)
    .is("abgelehnt_am", null)
    .order("created_at", { ascending: true });
  return (data as Route[]) ?? [];
}
