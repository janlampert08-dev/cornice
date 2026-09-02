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
    const [vehicleResult, rideResult] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("route_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    // Ein Query-Fehler bedeutet "unbekannt", nicht "keine Zeilen" — count wäre
    // in beiden Fällen null. Im Fehlerfall den Schritt lieber als erledigt
    // behandeln (die Checkliste blendet den Hinweis dann aus) statt fälschlich
    // "nicht erledigt" zu zeigen: sonst sähe ein bestehender Fahrzeug-/
    // Fahrten-Besitzer bei einem kurzen Supabase-Hänger eine falsche
    // "füge X hinzu"-Aufforderung für etwas, das er längst hat.
    hasVehicle = vehicleResult.error ? true : (vehicleResult.count ?? 0) > 0;
    hasTrackedRide = rideResult.error ? true : (rideResult.count ?? 0) > 0;
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
