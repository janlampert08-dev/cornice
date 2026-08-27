import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NeueStreckeForm from "@/components/NeueStreckeForm";

export default async function NeueStreckePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("ist_premium")
    .eq("id", user.id)
    .maybeSingle();

  return <NeueStreckeForm istPremium={profile?.ist_premium ?? false} />;
}
