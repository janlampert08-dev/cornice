"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/actions/favorites";

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
    <button
      onClick={handleClick}
      disabled={pending}
      className="self-start rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:border-foreground disabled:opacity-50"
    >
      {favorite ? "★ Gemerkt" : "☆ Merken"}
    </button>
  );
}
