"use client";

import { useTransition } from "react";
import { deleteOwnRejectedRoute } from "@/lib/actions/routes";

export default function DeleteProposalButton({ routeId }: { routeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("Abgelehnten Vorschlag endgültig löschen?")) {
          startTransition(() => deleteOwnRejectedRoute(routeId));
        }
      }}
      disabled={pending}
      className="shrink-0 text-xs text-[#8A8F98] hover:text-red-600 disabled:opacity-50"
    >
      Löschen
    </button>
  );
}
