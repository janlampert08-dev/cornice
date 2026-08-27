"use client";

import { useRef, useState } from "react";

const MAX_FOTO_BYTES = 8 * 1024 * 1024;

export default function PhotoInput({ name, id }: { name: string; id: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setFileName(null);
      setSizeError(false);
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      if (inputRef.current) inputRef.current.value = "";
      setPreview(null);
      setFileName(null);
      setSizeError(true);
      return;
    }
    setSizeError(false);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setFileName(null);
    setSizeError(false);
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>Foto (optional)</span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        name={name}
        accept="image/*"
        onChange={handleChange}
        className="sr-only"
      />
      {preview ? (
        <div className="flex items-center gap-3 border border-[#131316]/30 px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-10 w-10 shrink-0 object-cover" />
          <span className="flex-1 truncate text-[#131316]">{fileName}</span>
          <button
            type="button"
            onClick={clear}
            aria-label="Foto entfernen"
            className="shrink-0 text-[#8A8F98] hover:text-[#131316]"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="cursor-pointer border border-dashed border-[#131316]/30 px-3 py-3 text-center text-[#8A8F98] hover:border-[#131316] hover:text-[#131316]"
        >
          + Foto hinzufügen
        </label>
      )}
      {sizeError && <span className="text-xs text-red-600">Foto ist zu gross (max. 8 MB).</span>}
    </div>
  );
}
