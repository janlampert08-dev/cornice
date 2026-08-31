"use client";

import { useActionState } from "react";
import { addVehicle, type VehicleFormState } from "@/lib/actions/vehicles";
import { Input, fieldClassName } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const initialState: VehicleFormState = { error: null };

export default function NeuesFahrzeugForm() {
  const [state, formAction, pending] = useActionState(addVehicle, initialState);

  return (
    <>
      <h1 className="text-display font-semibold">Fahrzeug hinzufügen</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Typ
          <select name="typ" required defaultValue="auto" className={fieldClassName()}>
            <option value="auto">Auto</option>
            <option value="motorrad">Motorrad</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Marke
          <Input type="text" name="marke" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Modell
          <Input type="text" name="modell" required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Getriebe
          <select name="getriebe" required defaultValue="manuell" className={fieldClassName()}>
            <option value="manuell">Manuell</option>
            <option value="automatik">Automatik</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Baujahr (optional)
          <Input type="number" name="baujahr" min={1900} max={2100} className="font-mono" />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern…" : "Speichern"}
        </Button>
      </form>
    </>
  );
}
