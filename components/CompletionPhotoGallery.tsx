"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { removeCompletionPhoto } from "@/lib/actions/completions";
import type { CompletionPhotoItem } from "@/lib/completions";

// Fotos-Sektion der Fahrt-Detailseite (app/fahrten/[id]/page.tsx), ersetzt
// CompletionPhoto.tsx (ein einzelnes Foto) — ab 0036_completion_photos.sql
// kann eine Fahrt mehrere Fotos haben. Gleiches Grid+Lightbox-Muster wie
// PhotoGallery.tsx (Streckenseite), zusätzlich mit Entfernen-Button pro Foto
// für den Besitzer. "Foto von {name}"-Bildunterschrift signalisiert, dass es
// sich um ein selbst hochgeladenes Foto handelt (nicht das Strecken-Cover).
export default function CompletionPhotoGallery({
  photos,
  canRemove,
  displayName,
}: {
  photos: CompletionPhotoItem[];
  canRemove: boolean;
  displayName: string | null;
}) {
  const [items, setItems] = useState(photos);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length],
  );
  const showNext = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, close, showPrev, showNext]);

  if (items.length === 0) return null;

  function handleRemove(photoId: string) {
    setItems((prev) => prev.filter((p) => p.id !== photoId));
    setOpenIndex(null);
    startTransition(async () => {
      await removeCompletionPhoto(photoId);
    });
  }

  const openPhoto = openIndex !== null ? items[openIndex] : null;
  const caption = `Foto von ${displayName ?? "Nutzer"}`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        Fotos ({items.length})
      </h2>
      <div className="grid grid-cols-3 gap-1">
        {items.map((photo, i) => (
          <div key={photo.id} className="relative aspect-square overflow-hidden rounded-md">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              title={caption}
              className="absolute inset-0"
            >
              <Image src={photo.fotoUrl} alt={caption} fill sizes="33vw" className="object-cover" />
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => handleRemove(photo.id)}
                aria-label="Foto entfernen"
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur transition-colors duration-fast hover:bg-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>

      {openPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fotoansicht"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Schliessen"
            className="absolute top-4 right-4 border border-background/40 bg-transparent px-3 py-1.5 text-sm text-background hover:bg-background hover:text-foreground"
          >
            Schliessen
          </button>

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Vorheriges Foto"
                className="absolute top-1/2 left-4 -translate-y-1/2 border border-background/40 bg-transparent px-3 py-2 text-lg text-background hover:bg-background hover:text-foreground"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label="Nächstes Foto"
                className="absolute top-1/2 right-4 -translate-y-1/2 border border-background/40 bg-transparent px-3 py-2 text-lg text-background hover:bg-background hover:text-foreground"
              >
                ›
              </button>
            </>
          )}

          <figure className="flex max-h-full max-w-full flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={openPhoto.fotoUrl}
              alt={caption}
              className="max-h-[80vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <figcaption className="text-sm text-background/70">
              {caption}
              {items.length > 1 && ` · ${openIndex! + 1}/${items.length}`}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
