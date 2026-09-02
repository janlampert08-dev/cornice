"use client";

import { useState, useTransition } from "react";
import {
  dismissRouteReport,
  dismissRatingReport,
  dismissCompletionReport,
  deleteReportedRoute,
  deleteReportedRating,
  unpublishReportedCompletion,
} from "@/lib/actions/moderation";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";

// Drei Varianten in einer Komponente statt dreier Kopien — "Ignorieren" ist
// überall dasselbe, nur die aufgerufenen Server Actions und die Beschriftung
// der zweiten Schaltfläche unterscheiden sich.
//
// Bei einer gemeldeten Fahrt ist diese zweite Aktion bewusst kein Löschen,
// sondern das Entöffentlichen: eine persönliche Aufzeichnung soll dem Fahrer
// erhalten bleiben, sie muss nur aus der Öffentlichkeit verschwinden.
const ACTIONS = {
  route: { dismiss: dismissRouteReport, act: deleteReportedRoute, label: "Strecke löschen" },
  rating: { dismiss: dismissRatingReport, act: deleteReportedRating, label: "Kommentar löschen" },
  completion: {
    dismiss: dismissCompletionReport,
    act: unpublishReportedCompletion,
    label: "Fahrt verbergen",
  },
} as const;

export default function ReportedContentActions({
  reportId,
  targetId,
  type,
  deleteConfirmDescription,
}: {
  reportId: string;
  targetId: string;
  type: keyof typeof ACTIONS;
  deleteConfirmDescription: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const { dismiss, act: remove, label } = ACTIONS[type];

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
        {label}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={label}
        description={deleteConfirmDescription}
        confirmLabel={type === "completion" ? "Verbergen" : "Löschen"}
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
