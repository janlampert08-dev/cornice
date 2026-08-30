"use client";

import { useTransition } from "react";
import { publishPrivateRoute } from "@/lib/actions/routes";

export default function PublishRouteButton({ routeId }: { routeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => publishPrivateRoute(routeId))}
      className="shrink-0 rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:border-foreground disabled:opacity-50"
    >
      {pending ? "…" : "Veröffentlichen"}
    </button>
  );
}
