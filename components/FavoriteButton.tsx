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
      className="self-start rounded-xl border border-[#131316]/20 px-3 py-1.5 text-sm text-[#131316] hover:border-[#131316] disabled:opacity-50"
    >
      {favorite ? "★ Gemerkt" : "☆ Merken"}
    </button>
  );
}
