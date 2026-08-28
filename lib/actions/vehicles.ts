"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FahrzeugTyp, Getriebe, Vehicle } from "@/types/database";

export interface VehicleFormState {
  error: string | null;
}

interface InsertVehicleResult {
  error: string | null;
  vehicle: Vehicle | null;
}

async function insertVehicleFromFormData(formData: FormData): Promise<InsertVehicleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Bitte melde dich zuerst an.", vehicle: null };
  }

  const typ = String(formData.get("typ")) as FahrzeugTyp;
  const marke = String(formData.get("marke") ?? "").trim();
  const modell = String(formData.get("modell") ?? "").trim();
  const getriebe = String(formData.get("getriebe")) as Getriebe;
  const baujahrRaw = String(formData.get("baujahr") ?? "").trim();
  const baujahr = baujahrRaw ? Number(baujahrRaw) : null;

  if (!marke || !modell) {
    return { error: "Marke und Modell sind erforderlich.", vehicle: null };
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({ user_id: user.id, typ, marke, modell, getriebe, baujahr })
    .select()
    .single();

  if (error) {
    return { error: "Fahrzeug konnte nicht gespeichert werden.", vehicle: null };
  }

  revalidatePath("/profil");
  return { error: null, vehicle: data as Vehicle };
}

export async function addVehicle(
  _prevState: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const { error } = await insertVehicleFromFormData(formData);
  if (error) return { error };
  redirect("/profil");
}

// Wie addVehicle, aber ohne redirect — fürs Inline-Formular im
// Live-Tracking-Fazit (LiveTrackingForm): ein Redirect würde dort die
// gesamte, nur im Speicher gehaltene Aufzeichnung durch Unmounten
// zerstören. Gibt das neue Fahrzeug zurück, damit der Aufrufer es direkt in
// die lokale Fahrzeugliste übernehmen kann, ohne die Seite neu zu laden.
export async function addVehicleInline(formData: FormData): Promise<InsertVehicleResult> {
  return insertVehicleFromFormData(formData);
}

export async function deleteVehicle(vehicleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Explizit auf den eigenen Nutzer filtern statt allein auf RLS zu
  // vertrauen (Defense-in-Depth — siehe app/profil/page.tsx für den gleichen
  // Grundsatz bei der Fahrzeug-Abfrage).
  await supabase.from("vehicles").delete().eq("id", vehicleId).eq("user_id", user.id);
  revalidatePath("/profil");
}
