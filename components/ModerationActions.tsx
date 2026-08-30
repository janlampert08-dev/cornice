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
        className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
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
        className="rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-muted hover:border-foreground disabled:opacity-50"
      >
        Ablehnen
      </button>
    </div>
  );
}
