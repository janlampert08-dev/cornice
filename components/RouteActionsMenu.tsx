"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { buildGoogleMapsUrl } from "@/lib/googleMaps";
import { buildGpx, gpxFileName } from "@/lib/gpx";
import { deleteRouteAsModerator } from "@/lib/actions/routes";
import type { RouteGeoJSON } from "@/types/database";

// Siehe components/PassStatusButton.tsx (Vorgänger dieser Komponente) für
// die Begründung: TCS pflegt eigene Seiten pro Pass, aber die genauen
// URL-Muster sind nicht für jeden Pass zuverlässig bekannt — ein falsch
// geratener Link wäre schlechter als der eine Klick über die (garantiert
// korrekte) Übersichtsseite.
const TCS_PORTAL_URL = "https://www.tcs.ch/de/tools/verkehrsinfo-verkehrslage/paesse-in-der-schweiz.php";

export default function RouteActionsMenu({
  route,
  moderator = false,
  isOwner = false,
}: {
  route: RouteGeoJSON;
  moderator?: boolean;
  isOwner?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, startDelete] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleShare() {
    const url = `${window.location.origin}/strecken/${route.id}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: route.name, url });
      } catch {
        // Nutzer hat den Teilen-Dialog abgebrochen — kein Fehlerzustand nötig.
      }
      setOpen(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    } catch {
      setOpen(false);
    }
  }

  function handleGpxExport() {
    const blob = new Blob([buildGpx(route)], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = gpxFileName(route.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function handleDelete() {
    if (confirm(`"${route.name}" endgültig löschen? Das kann nicht rückgängig gemacht werden.`)) {
      startDelete(() => deleteRouteAsModerator(route.id));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Weitere Aktionen"
        aria-expanded={open}
        className="rounded-xl border border-foreground/20 px-3 py-1.5 text-sm text-foreground hover:border-foreground"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-56 flex-col rounded-xl border border-foreground/15 shadow-sm bg-background">
          <button
            type="button"
            onClick={handleShare}
            className="px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
          >
            {copied ? "Link kopiert ✓" : "Teilen"}
          </button>
          <a
            href={buildGoogleMapsUrl(route)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
          >
            In Google Maps öffnen ↗
          </a>
          <button
            type="button"
            onClick={handleGpxExport}
            className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
          >
            GPX exportieren
          </button>
          {route.saison_status === "saisonal" && (
            <a
              href={TCS_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
            >
              Live-Passstatus (TCS) ↗
            </a>
          )}
          {isOwner && (
            <Link
              href={`/strecken/${route.id}/bearbeiten`}
              onClick={() => setOpen(false)}
              className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
            >
              Bearbeiten
            </Link>
          )}
          {moderator && (
            <>
              <Link
                href={`/strecken/${route.id}/bearbeiten`}
                onClick={() => setOpen(false)}
                className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.05]"
              >
                Bearbeiten (Moderation)
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="border-t border-foreground/10 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-600/5 disabled:opacity-50"
              >
                {deleting ? "Wird gelöscht…" : "Strecke löschen"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
