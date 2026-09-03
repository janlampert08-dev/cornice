"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/url";
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
  // Optionales verstecktes Feld "next" (siehe NeuesFahrzeugForm.tsx) bringt
  // Nutzer nach dem Speichern dorthin zurück, von wo sie hierher kamen,
  // statt immer fest zu /profil zu springen.
  redirect(safeInternalPath(formData.get("next") as string | null) ?? "/profil");
}

// Wie addVehicle, aber ohne redirect — fürs Inline-Formular im
// Live-Tracking-Fazit (LiveTrackingForm): ein Redirect würde dort die
// gesamte, nur im Speicher gehaltene Aufzeichnung durch Unmounten
// zerstören. Gibt das neue Fahrzeug zurück, damit der Aufrufer es direkt in
// die lokale Fahrzeugliste übernehmen kann, ohne die Seite neu zu laden.
export async function addVehicleInline(formData: FormData): Promise<InsertVehicleResult> {
  return insertVehicleFromFormData(formData);
}

export interface DeleteVehicleState {
  error: string | null;
}

export async function deleteVehicle(vehicleId: string): Promise<DeleteVehicleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Bitte melde dich zuerst an." };

  // Explizit auf den eigenen Nutzer filtern statt allein auf RLS zu
  // vertrauen (Defense-in-Depth — siehe app/profil/page.tsx für den gleichen
  // Grundsatz bei der Fahrzeug-Abfrage). Vorab-Check wie in completions.ts
  // (z.B. removeCompletionPhoto): ohne ihn würde ein durch RLS/den
  // user_id-Filter blockierter Löschversuch (0 betroffene Zeilen, kein
  // Supabase-Error) fälschlich als Erfolg durchgehen.
  const { data: existing } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return { error: "Fahrzeug nicht gefunden." };

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("user_id", user.id);

  if (error) return { error: "Fahrzeug konnte nicht entfernt werden." };

  revalidatePath("/profil");
  return { error: null };
}
