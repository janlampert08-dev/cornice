"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Etwas ist schiefgelaufen.</p>
      <p className="max-w-sm text-sm text-[#8A8F98]">
        Die Daten konnten nicht geladen werden. Bitte versuche es erneut.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90"
        >
          Erneut versuchen
        </button>
        <Link
          href="/"
          className="border border-[#131316]/30 px-4 py-2 text-sm text-[#131316] hover:border-[#131316]"
        >
          Zur Übersicht
        </Link>
      </div>
    </div>
  );
}
