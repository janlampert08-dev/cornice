"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoutePhoto } from "@/types/database";

export default function PhotoGallery({ photos }: { photos: RoutePhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  );
  const showNext = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  );

  // Tastatursteuerung + Scroll-Sperre nur während die Lightbox offen ist —
  // Hintergrund bleibt an Ort und Stelle, statt hinter dem Overlay wegzuscrollen.
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

  if (photos.length === 0) return null;

  const openPhoto = openIndex !== null ? photos[openIndex] : null;

  return (
    <section className="flex flex-col gap-3 border-t border-[#131316]/10 pt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">
        Fotos ({photos.length})
      </h2>
      <div className="grid grid-cols-3 gap-1">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="aspect-square overflow-hidden bg-[#131316]/5"
            title={photo.display_name ?? undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.foto_url}
              alt={`Foto von ${photo.display_name ?? "Nutzer"}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {openPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fotoansicht"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#131316]/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Schliessen"
            className="absolute right-4 top-4 border border-[#FAFAFA]/40 bg-transparent px-3 py-1.5 text-sm text-[#FAFAFA] hover:bg-[#FAFAFA] hover:text-[#131316]"
          >
            Schliessen
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Vorheriges Foto"
                className="absolute left-4 top-1/2 -translate-y-1/2 border border-[#FAFAFA]/40 bg-transparent px-3 py-2 text-lg text-[#FAFAFA] hover:bg-[#FAFAFA] hover:text-[#131316]"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 border border-[#FAFAFA]/40 bg-transparent px-3 py-2 text-lg text-[#FAFAFA] hover:bg-[#FAFAFA] hover:text-[#131316]"
              >
                ›
              </button>
            </>
          )}

          <figure className="flex max-h-full max-w-full flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={openPhoto.foto_url}
              alt={`Foto von ${openPhoto.display_name ?? "Nutzer"}`}
              className="max-h-[80vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <figcaption className="text-sm text-[#FAFAFA]/70">
              {openPhoto.display_name ?? "Anonym"}
              {photos.length > 1 && ` · ${openIndex! + 1}/${photos.length}`}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
