"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { approveRoute, rejectRoute } from "@/lib/actions/moderation";
import Button, { buttonVariants } from "@/components/ui/Button";
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
      {/* Start-/Zielort und Region werden bei "Strecke vorschlagen" per
          Reverse-Geocoding automatisch ermittelt (siehe proposeRoute()) —
          dieser Link führt zur bestehenden Moderations-Bearbeitung, falls
          ein Wert vor der Freigabe korrigiert werden muss. */}
      <Link href={`/strecken/${routeId}/bearbeiten`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        Bearbeiten
      </Link>
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
