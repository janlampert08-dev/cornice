"use client";

import { useTransition } from "react";
import { publishPrivateRoute } from "@/lib/actions/routes";
import Button from "@/components/ui/Button";

export default function PublishRouteButton({ routeId }: { routeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => publishPrivateRoute(routeId))}
      className="shrink-0"
    >
      {pending ? "…" : "Veröffentlichen"}
    </Button>
  );
}
