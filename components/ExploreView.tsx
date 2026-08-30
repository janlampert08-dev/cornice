"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ExploreSidebar from "@/components/ExploreSidebar";
import { haversineKm } from "@/lib/geo";
import { matchesSearch } from "@/lib/search";
import { computeSignatures } from "@/lib/signature";
import type { Kategorie, RouteGeoJSON } from "@/types/database";

// mapbox-gl ist eine schwere Abhängigkeit (WebGL, eigenes CSS) — dynamisch
// geladen, damit Suchfeld/Streckenliste interaktiv werden, ohne auf den
// Kartencode zu warten, statt beides in einem Chunk zu bündeln. ssr:false,
// da mapbox-gl direkten DOM-/WebGL-Zugriff braucht.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-background" />,
});

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
  const [selectedKategorien, setSelectedKategorien] = useState<Kategorie[]>([]);

  const onHoverRoute = useCallback((id: string | null) => setHoveredRouteId(id), []);

  const onToggleKategorie = useCallback((kategorie: Kategorie) => {
    setSelectedKategorien((current) =>
      current.includes(kategorie)
        ? current.filter((k) => k !== kategorie)
        : [...current, kategorie],
    );
  }, []);

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
    let filtered = searchQuery.trim()
      ? routes.filter((r) => matchesSearch(r, searchQuery))
      : routes;

    // Eine Strecke passt, sobald sie mindestens eines der ausgewählten Tags
    // trägt (ODER-Verknüpfung) — Strecken haben meist nur 1-2 Kategorien, eine
    // UND-Verknüpfung würde die Auswahl bei mehreren aktiven Tags zu stark
    // einschränken.
    if (selectedKategorien.length > 0) {
      filtered = filtered.filter((r) =>
        r.kategorien.some((k) => selectedKategorien.includes(k)),
      );
    }

    if (!userLocation) return filtered;

    return [...filtered].sort(
      (a, b) =>
        haversineKm(userLocation, a.start_geojson.coordinates) -
        haversineKm(userLocation, b.start_geojson.coordinates),
    );
  }, [routes, searchQuery, selectedKategorien, userLocation]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className="h-64 shrink-0 md:order-2 md:h-auto md:flex-1"
        role="img"
        aria-label="Kartenansicht der Strecken — die vollständige Liste steht in der Seitenleiste."
      >
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
        selectedKategorien={selectedKategorien}
        onToggleKategorie={onToggleKategorie}
      />
    </main>
  );
}
