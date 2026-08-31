"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/actions/favorites";
import Button from "@/components/ui/Button";

export default function FavoriteButton({
  routeId,
  initialFavorite,
}: {
  routeId: string;
  initialFavorite: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setFavorite((f) => !f);
    startTransition(async () => {
      const { ok } = await toggleFavorite(routeId);
      if (!ok) setFavorite((f) => !f);
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={pending} className="self-start">
      {favorite ? "★ Gemerkt" : "☆ Merken"}
    </Button>
  );
}
