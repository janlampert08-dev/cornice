"use client";

import { useActionState } from "react";
import { addVehicle, type VehicleFormState } from "@/lib/actions/vehicles";

const initialState: VehicleFormState = { error: null };

export default function NeuesFahrzeugForm() {
  const [state, formAction, pending] = useActionState(addVehicle, initialState);

  return (
    <>
      <h1 className="text-xl font-semibold">Fahrzeug hinzufügen</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Typ
          <select
            name="typ"
            required
            defaultValue="auto"
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          >
            <option value="auto">Auto</option>
            <option value="motorrad">Motorrad</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Marke
          <input
            type="text"
            name="marke"
            required
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Modell
          <input
            type="text"
            name="modell"
            required
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Getriebe
          <select
            name="getriebe"
            required
            defaultValue="manuell"
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          >
            <option value="manuell">Manuell</option>
            <option value="automatik">Automatik</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Baujahr (optional)
          <input
            type="number"
            name="baujahr"
            min={1900}
            max={2100}
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-shadow"
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Speichern…" : "Speichern"}
        </button>
      </form>
    </>
  );
}
