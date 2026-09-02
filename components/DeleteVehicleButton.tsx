"use client";

import { useState, useTransition } from "react";
import { deleteVehicle } from "@/lib/actions/vehicles";
import { ConfirmDialog } from "@/components/ui/Dialog";

export default function DeleteVehicleButton({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="rounded-md px-3 py-2 text-xs text-muted transition-colors duration-fast hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Wird entfernt…" : "Entfernen"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
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
          setError(null);
          startTransition(async () => {
            const result = await deleteVehicle(vehicleId);
            if (result.error) setError(result.error);
          });
        }}
      />
    </div>
  );
}
