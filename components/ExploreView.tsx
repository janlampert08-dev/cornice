"use client";

import { useCallback, useMemo, useState } from "react";
import RouteMap from "@/components/RouteMap";
import ExploreSidebar from "@/components/ExploreSidebar";
import { haversineKm } from "@/lib/geo";
import { matchesSearch } from "@/lib/search";
import { computeSignatures } from "@/lib/signature";
import type { RouteGeoJSON } from "@/types/database";

export default function ExploreView({
  routes,
  loadError = false,
}: {
  routes: RouteGeoJSON[];
  loadError?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  const onHoverRoute = useCallback((id: string | null) => setHoveredRouteId(id), []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation wird von diesem Browser nicht unterstützt.");
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.longitude, position.coords.latitude]);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Standortzugriff wurde verweigert."
            : "Standort konnte nicht ermittelt werden.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // Über den gesamten (ungefilterten) Bestand berechnet, damit das
  // Signatur-Merkmal und seine Farbe je Strecke stabil bleiben — eine
  // Textsuche schränkt nur die sichtbare Auswahl ein, ohne die Perzentile
  // (und damit Merkmale/Farben) der übrigen Strecken zu verschieben.
  const signatures = useMemo(() => computeSignatures(routes), [routes]);
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    signatures.forEach((sig, id) => map.set(id, sig.color));
    return map;
  }, [signatures]);

  const visibleRoutes = useMemo(() => {
    const filtered = searchQuery.trim()
      ? routes.filter((r) => matchesSearch(r, searchQuery))
      : routes;

    if (!userLocation) return filtered;

    return [...filtered].sort(
      (a, b) =>
        haversineKm(userLocation, a.start_geojson.coordinates) -
        haversineKm(userLocation, b.start_geojson.coordinates),
    );
  }, [routes, searchQuery, userLocation]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <div className="h-64 shrink-0 md:order-2 md:h-auto md:flex-1">
        <RouteMap
          routes={visibleRoutes}
          userLocation={userLocation}
          colors={colors}
          hoveredRouteId={hoveredRouteId}
        />
      </div>
      <ExploreSidebar
        routes={visibleRoutes}
        loadError={loadError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        signatures={signatures}
        userLocation={userLocation}
        locating={locating}
        locationError={locationError}
        onRequestLocation={requestLocation}
        onHoverRoute={onHoverRoute}
      />
    </main>
  );
}
