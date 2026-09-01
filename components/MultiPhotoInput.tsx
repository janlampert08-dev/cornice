"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const MAX_FOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 6;

interface PhotoEntry {
  file: File;
  preview: string;
}

// Mehrfach-Variante von PhotoInput.tsx (früher: genau ein Foto pro Fahrt) —
// hängt ausgewählte Dateien in einem versteckten <input multiple> unter
// demselben Feldnamen an, FormData.getAll(name) liefert beim Absenden alle
// zurück (logTrackedCompletion, lib/actions/completions.ts). Serverseitig
// zusätzlich auf MAX_PHOTOS_PER_COMPLETION begrenzt — diese Clientgrenze ist
// nur UX, keine Durchsetzung.
export default function MultiPhotoInput({ name, id }: { name: string; id: string }) {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [sizeError, setSizeError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object-URLs statt FileReader.readAsDataURL(): siehe PhotoInput.tsx für
  // die Begründung (spürbares Hängen auf Mobilgeräten bei grossen Base64-
  // Strings). Müssen beim Unmount wieder freigegeben werden.
  useEffect(() => {
    return () => {
      for (const entry of entries) URL.revokeObjectURL(entry.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncInputFiles(next: PhotoEntry[]) {
    const dt = new DataTransfer();
    for (const entry of next) dt.items.add(entry.file);
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const oversized = files.some((f) => f.size > MAX_FOTO_BYTES);
    setSizeError(oversized);
    const accepted = files.filter((f) => f.size <= MAX_FOTO_BYTES);

    setEntries((prev) => {
      const next = [...prev, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(
        0,
        MAX_PHOTOS,
      );
      syncInputFiles(next);
      return next;
    });
  }

  function removeAt(index: number) {
    setEntries((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      const next = prev.filter((_, i) => i !== index);
      syncInputFiles(next);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-baseline justify-between">
        <span>Fotos (optional)</span>
        {entries.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted">
            {entries.length}/{MAX_PHOTOS}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept="image/*"
        multiple
        onChange={handleChange}
        className="sr-only"
      />
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {entries.map((entry, i) => (
            <div key={entry.preview} className="relative aspect-square overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Foto entfernen"
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur transition-colors duration-fast hover:bg-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      {entries.length < MAX_PHOTOS && (
        <label
          htmlFor={id}
          className="cursor-pointer rounded-md border border-dashed border-border px-3 py-3 text-center text-muted transition-colors duration-fast hover:border-border-strong hover:text-foreground"
        >
          + Foto hinzufügen
        </label>
      )}
      {sizeError && <span className="text-xs text-danger">Ein Foto ist zu gross (max. 8 MB).</span>}
    </div>
  );
}
