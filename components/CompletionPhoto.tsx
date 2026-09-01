"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { removeCompletionPhoto } from "@/lib/actions/completions";
import Card from "@/components/ui/Card";

// Fotos-Sektion der Fahrt-Detailseite (app/fahrten/[id]/page.tsx) — die
// einzige Stelle ausser der Streckenseite (PhotoGallery), an der ein
// hochgeladenes Fahrt-Foto angezeigt wird. Entfernen-Button nur für den
// Besitzer, optimistisch ausgeblendet (gleiches Muster wie KudosButton),
// bei Fehlschlag wieder eingeblendet.
export default function CompletionPhoto({
  completionId,
  fotoUrl,
  canRemove,
}: {
  completionId: string;
  fotoUrl: string;
  canRemove: boolean;
}) {
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (removed) return null;

  function handleRemove() {
    setRemoved(true);
    startTransition(async () => {
      const result = await removeCompletionPhoto(completionId);
      if (result.error) {
        setRemoved(false);
        setError(result.error);
      }
    });
  }

  return (
    <Card className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-video">
      <Image
        src={fotoUrl}
        alt="Foto dieser Fahrt"
        fill
        sizes="(min-width: 640px) 42rem, 100vw"
        className="object-cover"
      />
      {canRemove && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          aria-label="Foto entfernen"
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur transition-colors duration-fast hover:bg-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {error && (
        <p className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
