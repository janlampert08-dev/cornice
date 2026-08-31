"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ExploreSidebar from "@/components/ExploreSidebar";
import DragSheet from "@/components/ui/DragSheet";
import Skeleton from "@/components/ui/Skeleton";
import { haversineKm } from "@/lib/geo";
import { matchesSearch } from "@/lib/search";
import { computeSignatures } from "@/lib/signature";
import { applyAdvancedFilters, EMPTY_ADVANCED_FILTERS, type AdvancedFilters } from "@/lib/exploreFilters";
import type { Kategorie, RouteGeoJSON } from "@/types/database";

// mapbox-gl ist eine schwere Abhängigkeit (WebGL, eigenes CSS) — dynamisch
// geladen, damit Suchfeld/Streckenliste interaktiv werden, ohne auf den
// Kartencode zu warten, statt beides in einem Chunk zu bündeln. ssr:false,
// da mapbox-gl direkten DOM-/WebGL-Zugriff braucht.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

// Bottom-Sheet-Massse (Mobile). PEEK entspricht ungefähr der bisherigen
// festen Kartenhöhe (h-64 = 256px) plus Platz für den Ziehgriff; EXPANDED_GAP
// lässt oben immer einen Streifen Karte sichtbar, damit der Kontext (wo bin
// ich?) beim voll aufgezogenen Sheet nicht verloren geht.
const SHEET_PEEK_PX = 272;
const SHEET_EXPANDED_GAP_PX = 96;

export default function ExploreView({
  routes,
  loadError = false,
  coverPhotos,
}: {
  routes: RouteGeoJSON[];
  loadError?: boolean;
  coverPhotos: Map<string, string>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedKategorien, setSelectedKategorien] = useState<Kategorie[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);

  // Bottom-Sheet-Container (nur < md relevant — ab md greift die feste
  // Liste-links/Karte-rechts-Aufteilung unverändert, siehe Klassen unten).
  // Die eigentliche Drag-/Tap-Mechanik steckt in DragSheet.tsx, wiederverwendet
  // auf der Routendetailseite (app/strecken/[id]/page.tsx).
  const containerRef = useRef<HTMLElement>(null);

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

    filtered = applyAdvancedFilters(filtered, advancedFilters);

    if (!userLocation) return filtered;

    return [...filtered].sort(
      (a, b) =>
        haversineKm(userLocation, a.start_geojson.coordinates) -
        haversineKm(userLocation, b.start_geojson.coordinates),
    );
  }, [routes, searchQuery, selectedKategorien, advancedFilters, userLocation]);

  return (
    <main ref={containerRef} className="relative flex flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className="absolute inset-0 md:static md:order-2 md:h-auto md:flex-1"
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

      {/* Mobile: Bottom-Sheet über der Karte, per Ziehgriff auf- und
          zuziehbar zwischen Peek- und Vollhöhe (siehe DragSheet.tsx).
          Ab md: display:contents statt eigener Box — der Wrapper selbst
          verschwindet aus dem Rendering, ExploreSidebar rutscht direkt als
          Flex-Kind in main hoch und übernimmt dort exakt wie vorher die
          Liste-links/Karte-rechts-Aufteilung über ihre eigenen
          w-full/max-w-*-Klassen. */}
      <DragSheet
        containerRef={containerRef}
        peekPx={SHEET_PEEK_PX}
        expandedGapPx={SHEET_EXPANDED_GAP_PX}
        handleLabels={{ expand: "Liste ausklappen", collapse: "Liste einklappen" }}
      >
        <ExploreSidebar
          routes={visibleRoutes}
          loadError={loadError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          signatures={signatures}
          coverPhotos={coverPhotos}
          userLocation={userLocation}
          locating={locating}
          locationError={locationError}
          onRequestLocation={requestLocation}
          onHoverRoute={setHoveredRouteId}
          selectedKategorien={selectedKategorien}
          onToggleKategorie={onToggleKategorie}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
        />
      </DragSheet>
    </main>
  );
}
