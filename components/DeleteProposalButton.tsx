"use client";

import { useState, useTransition } from "react";
import { deleteOwnRejectedRoute } from "@/lib/actions/routes";
import { ConfirmDialog } from "@/components/ui/Dialog";

export default function DeleteProposalButton({ routeId }: { routeId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="shrink-0 text-xs text-muted transition-colors duration-fast hover:text-danger disabled:opacity-50"
      >
        Löschen
      </button>
      <ConfirmDialog
        open={open}
        title="Vorschlag löschen"
        description="Der abgelehnte Vorschlag wird endgültig gelöscht."
        confirmLabel="Löschen"
        variant="danger"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          startTransition(() => deleteOwnRejectedRoute(routeId));
        }}
      />
    </>
  );
}
