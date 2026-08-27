import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PremiumPurchaseView from "@/components/PremiumPurchaseView";
import { createClient } from "@/lib/supabase/server";

export default async function PremiumPage() {
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

  if (profile?.ist_premium) redirect("/profil");

  return (
    <div className="flex h-screen flex-col">
      <Header back="/profil" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-8 sm:px-6">
        <PremiumPurchaseView />
      </main>
    </div>
  );
}
