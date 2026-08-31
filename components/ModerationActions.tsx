"use client";

import { useState, useTransition } from "react";
import { approveRoute, rejectRoute } from "@/lib/actions/moderation";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";

export default function ModerationActions({ routeId }: { routeId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => startTransition(() => approveRoute(routeId))}
        disabled={pending}
      >
        Freischalten
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        Ablehnen
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Vorschlag ablehnen"
        description="Der Vorschlag wird als abgelehnt markiert und ist für die Ersteller:in nicht mehr sichtbar veröffentlicht."
        confirmLabel="Ablehnen"
        variant="danger"
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startTransition(() => rejectRoute(routeId));
        }}
      />
    </div>
  );
}
