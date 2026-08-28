"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import TrafficIndicator, { type TrafficChipState } from "@/components/TrafficIndicator";
import { SPEED_LEGEND } from "@/lib/speed";
import {
  CONGESTION_META,
  fetchCongestionLevels,
  sliceRouteByTraffic,
  worstCongestion,
  type CongestionLevel,
} from "@/lib/traffic";
import type { RouteGeoJSON } from "@/types/database";

// Siehe ExploreView.tsx für die Begründung des dynamischen Imports.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#FAFAFA]" />,
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Etwa ein Abfragepunkt pro 800m — genug, um Stauabschnitte sichtbar entlang
// der Strecke einzufärben, ohne bei langen Alpenpässen Hunderte parallele
// Tilequery-Aufrufe auszulösen.
const MIN_SAMPLES = 6;
const MAX_SAMPLES = 24;
const SAMPLES_PER_KM = 1.2;

export default function RouteDetailMap({ route }: { route: RouteGeoJSON }) {
  const [showSpeedLimits, setShowSpeedLimits] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const hasTempolimits = !!route.tempolimits?.length;

  const coordinates = route.geometry_geojson.coordinates as [number, number][];
  const unavailable = !MAPBOX_TOKEN || coordinates.length < 2;

  // Einzige Verkehrsabfrage der Seite (siehe lib/traffic.ts) — speist sowohl
  // den Chip (worstCongestion) als auch die eingefärbten Kartenabschnitte
  // (sliceRouteByTraffic), statt wie zuvor zwei unabhängige Mechanismen zu
  // pflegen. Kein manueller Reset beim Streckenwechsel nötig: die Seite
  // rendert diese Komponente mit key={route.id} (siehe
  // app/strecken/[id]/page.tsx), ein Streckenwechsel montiert sie also neu.
  const [levels, setLevels] = useState<(CongestionLevel | null)[] | null>(null);

  useEffect(() => {
    if (unavailable) return;
    let cancelled = false;

    const sampleCount = Math.min(
      MAX_SAMPLES,
      Math.max(MIN_SAMPLES, Math.round(route.laenge_km * SAMPLES_PER_KM)),
    );

    fetchCongestionLevels(coordinates, sampleCount, MAPBOX_TOKEN!).then((result) => {
      if (!cancelled) setLevels(result);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  const trafficState: TrafficChipState = unavailable
    ? "none"
    : levels === null
      ? "loading"
      : (worstCongestion(levels.filter((l): l is CongestionLevel => l !== null)) ?? "none");

  const trafficSegments = useMemo(() => {
    if (!levels) return [];
    return sliceRouteByTraffic(coordinates, levels)
      .filter((s): s is { coords: [number, number][]; level: CongestionLevel } => s.level !== null)
      .map((s) => ({ coords: s.coords, color: CONGESTION_META[s.level].color }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  return (
    <div className="relative h-full w-full">
      <RouteMap
        routes={[route]}
        showSpeedLimits={showSpeedLimits}
        showTraffic={showTraffic}
        trafficSegments={trafficSegments}
      />
      <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          {hasTempolimits && (
            <button
              onClick={() => setShowSpeedLimits((v) => !v)}
              className="border border-[#131316] bg-[#FAFAFA] px-3 py-1.5 text-sm font-medium text-[#131316] hover:bg-[#131316] hover:text-[#FAFAFA]"
            >
              {showSpeedLimits ? "Tempolimits ausblenden" : "Tempolimits anzeigen"}
            </button>
          )}
          <TrafficIndicator
            state={trafficState}
            active={showTraffic}
            onToggle={() => setShowTraffic((v) => !v)}
          />
        </div>
        {showSpeedLimits && (
          <div className="flex flex-col gap-1 border border-[#131316]/20 bg-[#FAFAFA] px-3 py-2 text-xs text-[#131316]">
            {SPEED_LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="h-0.5 w-4" style={{ backgroundColor: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        )}
        {showTraffic && trafficSegments.length > 0 && (
          <div className="flex flex-col gap-1 border border-[#131316]/20 bg-[#FAFAFA] px-3 py-2 text-xs text-[#131316]">
            {Object.values(CONGESTION_META).map((meta) => (
              <div key={meta.label} className="flex items-center gap-2">
                <span className="h-0.5 w-4" style={{ backgroundColor: meta.color }} />
                {meta.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
