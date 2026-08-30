"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted hover:text-foreground"
    >
      ← Zurück
    </button>
  );
}
