import { redirect } from "next/navigation";
import FreeRideForm from "@/components/FreeRideForm";
import { createClient } from "@/lib/supabase/server";
import { getRoutes } from "@/lib/routes";
import type { Vehicle } from "@/types/database";

export const metadata = {
  title: "Fahrt aufzeichnen – Cornice",
};

// Einstieg für eine freie Fahrt (ohne Strecke). Das Gegenstück zur
// Streckenfahrt, die über "Strecke starten" auf der Streckenseite beginnt
// (components/GefahrenSection.tsx) — beide landen im selben Recorder, nur
// mit bzw. ohne Streckenbezug.
export default async function NeueFahrtPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  // Die freigegebenen Strecken dienen auf der Aufzeichnungskarte nur der
  // Orientierung ("fahre ich gerade auf einer kuratierten Strecke?") — sie
  // sind dort bewusst nicht anklickbar, siehe routesAsBackdrop in RouteMap.
  // Ein Ladefehler kostet nur diese Orientierungshilfe, nicht die
  // Aufzeichnung: dann startet die Karte eben ohne Streckenlinien.
  const [{ data: vehicles }, { routes }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getRoutes(),
  ]);

  return (
    <FreeRideForm userId={user.id} vehicles={(vehicles as Vehicle[]) ?? []} routes={routes} />
  );
}
