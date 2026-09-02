"use client";

import dynamic from "next/dynamic";
import Skeleton from "@/components/ui/Skeleton";
import type { GeoLineString, RouteGeoJSON } from "@/types/database";

// Siehe ExploreView.tsx für die Begründung des dynamischen Imports.
// Eigene kleine Client-Wrapper-Komponente, da app/fahrten/[id]/page.tsx
// (Server Component) selbst kein ssr:false verwenden darf.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const NO_ROUTES: never[] = [];

// Zwei Fälle: eine Streckenfahrt zeigt die Streckengeometrie, eine freie
// Fahrt den aufgezeichneten GPS-Track (die einzige Geometrie, die sie hat).
export default function CompletionMap({
  route,
  track,
}: {
  route?: RouteGeoJSON | null;
  track?: GeoLineString | null;
}) {
  if (route) return <RouteMap routes={[route]} />;

  return (
    <RouteMap
      routes={NO_ROUTES}
      trail={(track?.coordinates as [number, number][]) ?? []}
      fitTrail
    />
  );
}
