"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { renderShareImage } from "@/lib/shareImage";
import type { GeoLineString } from "@/types/database";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ShareRideButton({
  routeId,
  distanceKm,
  durationSeconds,
  date,
}: {
  routeId: string;
  distanceKm: number;
  durationSeconds: number | null;
  date: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const supabase = createClient();
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

      const blob = await renderShareImage({
        routeName: route.name,
        region: route.region,
        distanceKm,
        durationSeconds,
        date,
        elevationM: route.hoehe_m,
        coordinates: route.geometry_geojson.coordinates,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(route.name)}-${date}.jpg`;
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
      disabled={loading}
      onClick={handleShare}
      className="shrink-0 text-xs text-accent hover:underline disabled:opacity-50"
    >
      {loading ? "…" : "Teilen"}
    </button>
  );
}
