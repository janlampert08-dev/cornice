"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      aria-label="Zurück"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border py-1 pr-3 pl-1.5 text-sm text-muted transition-colors duration-fast hover:border-border-strong hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      <span className="whitespace-nowrap">Zurück</span>
    </button>
  );
}
