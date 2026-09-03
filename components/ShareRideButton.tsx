"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { renderShareImage } from "@/lib/shareImage";
import type { GeoLineString } from "@/types/database";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Das Teilen-Bild wird erst beim Klick zusammengebaut: die Geometrie dafür
// wird bewusst nicht mit der Seite ausgeliefert, sondern hier nachgeladen.
//
// Zwei Quellen, je nach Fahrtart: eine Streckenfahrt zeichnet die
// Streckengeometrie (routes_geojson), eine freie Fahrt ihren eigenen,
// öffentlich gekappten Track (public_fahrt_tracks, siehe 0045). Für eine
// freie Fahrt, die nicht geteilt ist, gibt es keinen öffentlichen Track —
// die Fahrt-Detailseite blendet den Knopf dann aus.
export default function ShareRideButton({
  routeId,
  completionId,
  title,
  region,
  elevationM,
  distanceKm,
  durationSeconds,
  date,
  milestoneLabel = null,
}: {
  routeId: string | null;
  completionId: string;
  title: string;
  region: string | null;
  elevationM: number | null;
  distanceKm: number;
  durationSeconds: number | null;
  date: string;
  // Höchster aktuell erreichter Meilenstein des Besitzers (lib/achievements.ts),
  // vom Aufrufer nur für den eigenen Fahrten-Detailscreen mitgegeben.
  milestoneLabel?: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const supabase = createClient();

      let coordinates: [number, number][] | null = null;
      let name = title;
      let regionLabel = region ?? "";
      let elevation = elevationM;

      if (routeId) {
        const { data: route } = await supabase
          .from("routes_geojson")
          .select("name, region, hoehe_m, geometry_geojson")
          .eq("id", routeId)
          .maybeSingle<{
            name: string;
            region: string;
            hoehe_m: number | null;
            geometry_geojson: GeoLineString;
          }>();

        if (!route) return;
        coordinates = route.geometry_geojson.coordinates;
        name = route.name;
        regionLabel = route.region;
        elevation = route.hoehe_m;
      } else {
        const { data: track } = await supabase
          .from("public_fahrt_tracks")
          .select("track_geojson")
          .eq("completion_id", completionId)
          .maybeSingle<{ track_geojson: GeoLineString }>();

        if (!track) return;
        coordinates = track.track_geojson.coordinates;
      }

      const blob = await renderShareImage({
        routeName: name,
        region: regionLabel,
        distanceKm,
        durationSeconds,
        date,
        elevationM: elevation,
        coordinates,
        milestoneLabel,
      });

      const filename = `${slugify(name)}-${date}.jpg`;

      // Natives Share-Sheet bevorzugt (Instagram Story/DM, WhatsApp etc. ohne
      // Umweg über den Download-Ordner) — nur wenn der Browser das für genau
      // diese Datei unterstützt (nicht überall der Fall, z.B. Desktop-Firefox).
      // navigator.canShare mit files ist erst Web-Share-API-Level-2, deshalb
      // der optionale Zugriff statt eines direkten Aufrufs.
      const file = new File([blob], filename, { type: "image/jpeg" });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: name });
          return;
        } catch (err) {
          // Nutzer hat den Share-Dialog abgebrochen — kein Fehler, kein
          // Download-Fallback nötig.
          if (err instanceof Error && err.name === "AbortError") return;
          // Andernfalls (z.B. Share fehlgeschlagen) auf den Download darunter
          // durchfallen.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      title="Fahrt als Bild teilen"
      aria-label="Fahrt als Bild teilen"
      disabled={loading}
      onClick={handleShare}
      className="shrink-0 text-muted transition-colors duration-fast hover:text-accent disabled:opacity-50"
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
