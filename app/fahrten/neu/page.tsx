import { redirect } from "next/navigation";
import FreeRideForm from "@/components/FreeRideForm";
import { createClient } from "@/lib/supabase/server";
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

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <FreeRideForm vehicles={(vehicles as Vehicle[]) ?? []} />;
}
