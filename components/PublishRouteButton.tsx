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
      className="shrink-0 border border-[#131316]/30 px-3 py-1.5 text-sm text-[#131316] hover:border-[#131316] disabled:opacity-50"
    >
      {pending ? "…" : "Veröffentlichen"}
    </button>
  );
}
