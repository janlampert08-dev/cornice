"use client";

import { useTransition } from "react";
import { deleteVehicle } from "@/lib/actions/vehicles";

export default function DeleteVehicleButton({ vehicleId }: { vehicleId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (confirm("Fahrzeug wirklich entfernen?")) {
          startTransition(() => deleteVehicle(vehicleId));
        }
      }}
      disabled={pending}
      className="text-xs text-[#8A8F98] hover:text-[#131316] disabled:opacity-50"
    >
      Entfernen
    </button>
  );
}
