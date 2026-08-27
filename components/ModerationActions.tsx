"use client";

import { useTransition } from "react";
import { approveRoute, rejectRoute } from "@/lib/actions/moderation";

export default function ModerationActions({ routeId }: { routeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => startTransition(() => approveRoute(routeId))}
        disabled={pending}
        className="border border-[#131316] bg-[#131316] px-3 py-1.5 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
      >
        Freischalten
      </button>
      <button
        onClick={() => {
          if (confirm("Vorschlag ablehnen?")) {
            startTransition(() => rejectRoute(routeId));
          }
        }}
        disabled={pending}
        className="border border-[#131316]/30 px-3 py-1.5 text-sm text-[#8A8F98] hover:border-[#131316] disabled:opacity-50"
      >
        Ablehnen
      </button>
    </div>
  );
}
