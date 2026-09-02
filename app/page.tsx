import Header from "@/components/Header";
import ExploreView from "@/components/ExploreView";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { getRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const [{ routes, error }, {
    data: { user },
  }] = await Promise.all([getRoutes(), supabase.auth.getUser()]);

  // Nur für eingeloggte Nutzer relevant — anonyme Besucher sehen die
  // Checkliste mit "Konto erstellen" als erstem, noch offenem Schritt.
  let hasVehicle = false;
  let hasTrackedRide = false;
  if (user) {
    const [{ count: vehicleCount }, { count: rideCount }] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("route_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    hasVehicle = (vehicleCount ?? 0) > 0;
    hasTrackedRide = (rideCount ?? 0) > 0;
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <OnboardingChecklist
        loggedIn={!!user}
        hasVehicle={hasVehicle}
        hasTrackedRide={hasTrackedRide}
      />
      <ExploreView routes={routes} loadError={error} />
    </div>
  );
}
