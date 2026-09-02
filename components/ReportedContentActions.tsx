"use client";

import { useState, useTransition } from "react";
import {
  dismissRouteReport,
  dismissRatingReport,
  deleteReportedRoute,
  deleteReportedRating,
} from "@/lib/actions/moderation";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";

// Zwei Varianten (Strecke/Kommentar) in einer Komponente statt zweier
// Kopien — "Ignorieren" und "Löschen" sind für beide identisch, nur die
// aufgerufenen Server Actions unterscheiden sich.
export default function ReportedContentActions({
  reportId,
  targetId,
  type,
  deleteConfirmDescription,
}: {
  reportId: string;
  targetId: string;
  type: "route" | "rating";
  deleteConfirmDescription: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dismiss = type === "route" ? dismissRouteReport : dismissRatingReport;
  const remove = type === "route" ? deleteReportedRoute : deleteReportedRating;

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => startTransition(() => dismiss(reportId))}
        disabled={pending}
      >
        Ignorieren
      </Button>
      <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}>
        {type === "route" ? "Strecke löschen" : "Kommentar löschen"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={type === "route" ? "Strecke löschen" : "Kommentar löschen"}
        description={deleteConfirmDescription}
        confirmLabel="Löschen"
        variant="danger"
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startTransition(() => remove(targetId));
        }}
      />
    </div>
  );
}
