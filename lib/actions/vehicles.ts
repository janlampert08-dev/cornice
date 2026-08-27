"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FahrzeugTyp, Getriebe } from "@/types/database";

export interface VehicleFormState {
  error: string | null;
}

export async function addVehicle(
  _prevState: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Bitte melde dich zuerst an." };
  }

  const typ = String(formData.get("typ")) as FahrzeugTyp;
  const marke = String(formData.get("marke") ?? "").trim();
  const modell = String(formData.get("modell") ?? "").trim();
  const getriebe = String(formData.get("getriebe")) as Getriebe;
  const baujahrRaw = String(formData.get("baujahr") ?? "").trim();
  const baujahr = baujahrRaw ? Number(baujahrRaw) : null;

  if (!marke || !modell) {
    return { error: "Marke und Modell sind erforderlich." };
  }

  const { error } = await supabase.from("vehicles").insert({
    user_id: user.id,
    typ,
    marke,
    modell,
    getriebe,
    baujahr,
  });

  if (error) {
    return { error: "Fahrzeug konnte nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  redirect("/profil");
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
