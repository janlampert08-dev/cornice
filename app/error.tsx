"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Etwas ist schiefgelaufen.</p>
      <p className="max-w-sm text-sm text-muted">
        Die Daten konnten nicht geladen werden. Bitte versuche es erneut.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Erneut versuchen
        </button>
        <Link
          href="/"
          className="rounded-xl border border-foreground/20 px-4 py-2 text-sm text-foreground hover:border-foreground"
        >
          Zur Übersicht
        </Link>
      </div>
    </div>
  );
}
