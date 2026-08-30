import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold">Seite nicht gefunden.</p>
      <p className="max-w-sm text-sm text-muted">
        Diese Strecke oder Seite existiert nicht (mehr).
      </p>
      <Link
        href="/"
        className="rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Zur Übersicht
      </Link>
    </div>
  );
}
