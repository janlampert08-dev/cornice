"use client";

import dynamic from "next/dynamic";
import Skeleton from "@/components/ui/Skeleton";
import type { RouteGeoJSON } from "@/types/database";

// Siehe ExploreView.tsx für die Begründung des dynamischen Imports.
// Eigene kleine Client-Wrapper-Komponente, da app/fahrten/[id]/page.tsx
// (Server Component) selbst kein ssr:false verwenden darf.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function CompletionMap({ route }: { route: RouteGeoJSON }) {
  return <RouteMap routes={[route]} />;
}
