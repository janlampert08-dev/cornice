"use client";

import { useState, useTransition } from "react";
import { deleteVehicle } from "@/lib/actions/vehicles";
import { ConfirmDialog } from "@/components/ui/Dialog";

export default function DeleteVehicleButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="text-xs text-muted transition-colors duration-fast hover:text-foreground disabled:opacity-50"
      >
        Entfernen
      </button>
      <ConfirmDialog
        open={open}
        title="Fahrzeug entfernen"
        description="Das Fahrzeug wird dauerhaft aus deinem Profil entfernt."
        confirmLabel="Entfernen"
        variant="danger"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          startTransition(() => deleteVehicle(vehicleId));
        }}
      />
    </>
  );
}
