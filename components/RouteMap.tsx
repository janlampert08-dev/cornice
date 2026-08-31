"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ZURICH_CENTER, DEFAULT_ZOOM } from "@/lib/constants";
import { sliceRouteBySpeed, speedColor } from "@/lib/speed";
import type { RouteGeoJSON, TempolimitSegment } from "@/types/database";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const ROUTES_SOURCE = "routes";
const ROUTES_LINE_LAYER = "routes-line";
const SPEED_SOURCE = "speed-segments";
const SPEED_LINE_LAYER = "speed-segments-line";
const ENDPOINTS_SOURCE = "route-endpoints";
const ENDPOINTS_LAYER = "route-endpoints-circle";
const TRAFFIC_SOURCE = "traffic-segments";
const TRAFFIC_LINE_LAYER = "traffic-segments-line";
const HIGHLIGHT_SOURCE = "route-highlight";
const HIGHLIGHT_HALO_LAYER = "route-highlight-halo";
const HIGHLIGHT_LINE_LAYER = "route-highlight-line";

// Verwandte Blautöne, damit einzelne Strecken auf der Übersichtskarte
// unterscheidbar sind, ohne aus dem Farbschema auszubrechen.
const ROUTE_BLUE_PALETTE = [
  "#3D5AFE",
  "#0EA5E9",
  "#2563EB",
  "#6366F1",
  "#0284C7",
  "#4F46E5",
  "#38BDF8",
  "#1D4ED8",
];

// Stabiler Hash der Strecken-ID statt Listenindex, damit eine Strecke ihre
// Farbe behält, auch wenn Filter die Reihenfolge/Auswahl ändern. Dient nur
// noch als Fallback, wenn keine Signatur-Farbe übergeben wurde (z.B. auf der
// Detailkarte mit nur einer Strecke).
function colorForRoute(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ROUTE_BLUE_PALETTE[hash % ROUTE_BLUE_PALETTE.length];
}

// Farbe kommt primär aus dem Signatur-Merkmal der Strecke (siehe
// lib/signature.ts) — so tragen Kartenlinie und Sidebar-Karte dieselbe
// Bedeutung: gleiches Merkmal, gleiche Farbe.
function resolveColor(colors: Map<string, string> | undefined, id: string): string {
  return colors?.get(id) ?? colorForRoute(id);
}

function toFeatureCollection(
  routes: RouteGeoJSON[],
  colors?: Map<string, string>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      id: route.id,
      geometry: route.geometry_geojson,
      properties: { id: route.id, name: route.name, color: resolveColor(colors, route.id) },
    })),
  };
}

// Bei Rundfahrten liegen Start und Ziel am selben Ort — dort nur ein Punkt,
// sonst je ein Punkt am Anfang und am Ende der Strecke.
function toEndpointFeatureCollection(
  routes: RouteGeoJSON[],
  colors?: Map<string, string>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const route of routes) {
    const color = resolveColor(colors, route.id);
    features.push({
      type: "Feature",
      geometry: route.start_geojson,
      properties: { id: route.id, kind: "start", color },
    });
    if (!route.ist_rundfahrt) {
      features.push({
        type: "Feature",
        geometry: route.ziel_geojson,
        properties: { id: route.id, kind: "ziel", color },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function toSpeedFeatureCollection(
  coords: [number, number][],
  segments: TempolimitSegment[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sliceRouteBySpeed(coords, segments).map((s) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: s.coords },
      properties: { kmh: s.kmh, color: speedColor(s.kmh) },
    })),
  };
}

// Bereits fertig eingefärbte Abschnitte (siehe RouteDetailMap, das sie aus
// lib/traffic.ts ableitet) — RouteMap kennt Stau-Level/-Farben selbst nicht,
// genau wie bei den Signatur-Farben der Strecken.
function toTrafficFeatureCollection(
  segments: { coords: [number, number][]; color: string }[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: segments.map((s) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: s.coords },
      properties: { color: s.color },
    })),
  };
}

// Kleiner, dezenter Punkt statt des Standard-Mapbox-Pins (der wie ein
// Pfeil/Tropfen aussieht) — orientiert sich an der üblichen Navi-App-
// Konvention (z.B. Google/Apple Maps: ein einfacher blauer Punkt statt
// eines auffälligen Markers). Bewusst eckig statt rund: im ansonsten
// durchgängig abgerundeten Design (siehe globals.css --radius-*) ist das
// der eine gewollte flache/technische Akzent — ein Fadenkreuz-Motiv, das
// sich absichtlich von der weichen Chrome drumherum absetzt.
function createLocationDotElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "12px";
  el.style.height = "12px";
  el.style.backgroundColor = "#3D5AFE";
  el.style.border = "2.5px solid #FAFAFA";
  el.style.boxShadow = "0 0 0 1px rgba(19,19,22,0.25), 0 1px 3px rgba(19,19,22,0.35)";
  return el;
}

function fitToRoutes(map: mapboxgl.Map, routes: RouteGeoJSON[], animate: boolean) {
  if (routes.length === 0) return;
  const bounds = new mapboxgl.LngLatBounds();
  for (const route of routes) {
    for (const coord of route.geometry_geojson.coordinates) {
      bounds.extend(coord as [number, number]);
    }
  }
  map.fitBounds(bounds, { padding: 48, duration: animate ? 500 : 0 });
}

export default function RouteMap({
  routes,
  userLocation,
  showSpeedLimits = false,
  showTraffic = false,
  colors,
  hoveredRouteId = null,
  trafficSegments = [],
}: {
  routes: RouteGeoJSON[];
  userLocation?: [number, number] | null;
  showSpeedLimits?: boolean;
  showTraffic?: boolean;
  colors?: Map<string, string>;
  hoveredRouteId?: string | null;
  trafficSegments?: { coords: [number, number][]; color: string }[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);
  const routesRef = useRef(routes);
  const colorsRef = useRef(colors);
  const locationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  const trafficSegmentsRef = useRef(trafficSegments);
  useEffect(() => {
    trafficSegmentsRef.current = trafficSegments;
  }, [trafficSegments]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: ZURICH_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Knapp unterhalb der Strassennummern-Schilder (z.B. A1-Schild) einfügen:
      // road-label (Strassennamen-Text) liegt in der Streets-v12-Style-
      // Reihenfolge VOR road-number-shield, also landet unsere Strecke über
      // den Namens-Labels, aber unter den Schildern — Schilder bleiben
      // sichtbar, Namens-Labels werden von der Strecke überdeckt. Existiert
      // der Layer nicht (Style-Update), fällt es auf das alte Verhalten
      // zurück (Strecke ganz oben, wie vor dieser Anpassung).
      const shieldLayerId = "road-number-shield";
      const firstSymbolId = map.getStyle().layers?.some((l) => l.id === shieldLayerId)
        ? shieldLayerId
        : undefined;

      map.addSource(ROUTES_SOURCE, {
        type: "geojson",
        data: toFeatureCollection(routesRef.current, colorsRef.current),
      });

      map.addLayer(
        {
          id: ROUTES_LINE_LAYER,
          type: "line",
          source: ROUTES_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4],
          },
        },
        firstSymbolId,
      );

      const single = routesRef.current.length === 1 ? routesRef.current[0] : null;
      map.addSource(SPEED_SOURCE, {
        type: "geojson",
        data:
          single?.tempolimits?.length
            ? toSpeedFeatureCollection(
                single.geometry_geojson.coordinates as [number, number][],
                single.tempolimits,
              )
            : { type: "FeatureCollection", features: [] },
      });
      map.addLayer(
        {
          id: SPEED_LINE_LAYER,
          type: "line",
          source: SPEED_SOURCE,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: showSpeedLimits ? "visible" : "none",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 6],
          },
        },
        firstSymbolId,
      );

      // Stau-Abschnitte direkt auf der Streckenlinie eingefärbt — analog zu
      // SPEED_LINE_LAYER, aus vorab (in RouteDetailMap) abgefragten und
      // eingefärbten Segmenten statt einer eigenen, alle Strassen der Umgebung
      // abdeckenden Verkehrs-Kachelebene.
      map.addSource(TRAFFIC_SOURCE, {
        type: "geojson",
        data: toTrafficFeatureCollection(trafficSegmentsRef.current),
      });
      map.addLayer(
        {
          id: TRAFFIC_LINE_LAYER,
          type: "line",
          source: TRAFFIC_SOURCE,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: showTraffic ? "visible" : "none",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 6],
          },
        },
        firstSymbolId,
      );

      // Hervorhebungs-Layer für den per Sidebar-Hover markierten Track: weisser
      // Halo (analog zum Stroke der Endpunkt-Punkte) plus farbige Linie darüber,
      // damit ein Hover auf der Karte sofort auffindbar ist.
      map.addSource(HIGHLIGHT_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer(
        {
          id: HIGHLIGHT_HALO_LAYER,
          type: "line",
          source: HIGHLIGHT_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#FAFAFA",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 6, 14, 11],
          },
        },
        firstSymbolId,
      );
      map.addLayer(
        {
          id: HIGHLIGHT_LINE_LAYER,
          type: "line",
          source: HIGHLIGHT_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 6],
          },
        },
        firstSymbolId,
      );

      map.addSource(ENDPOINTS_SOURCE, {
        type: "geojson",
        data: toEndpointFeatureCollection(routesRef.current, colorsRef.current),
      });
      map.addLayer(
        {
          id: ENDPOINTS_LAYER,
          type: "circle",
          source: ENDPOINTS_SOURCE,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 14, 5.5],
            "circle-color": ["get", "color"],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#FAFAFA",
          },
        },
        firstSymbolId,
      );

      fitToRoutes(map, routesRef.current, false);

      map.on("mouseenter", ROUTES_LINE_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", ROUTES_LINE_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", ROUTES_LINE_LAYER, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) router.push(`/strecken/${id}`);
      });

      styleLoadedRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kartendaten aktualisieren, wenn sich die gefilterte Streckenliste oder die
  // Signatur-Farben ändern.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const source = map.getSource(ROUTES_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(toFeatureCollection(routes, colors));

    const endpointsSource = map.getSource(ENDPOINTS_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    endpointsSource?.setData(toEndpointFeatureCollection(routes, colors));

    const single = routes.length === 1 ? routes[0] : null;
    const speedSource = map.getSource(SPEED_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    speedSource?.setData(
      single?.tempolimits?.length
        ? toSpeedFeatureCollection(
            single.geometry_geojson.coordinates as [number, number][],
            single.tempolimits,
          )
        : { type: "FeatureCollection", features: [] },
    );

    fitToRoutes(map, routes, true);
  }, [routes, colors]);

  // Markiert die per Sidebar-Hover (oder Tastaturfokus) ausgewählte Strecke auf
  // der Karte — eigener Source/Layer statt feature-state, weil hier ohnehin
  // eine ganze Strecke (nicht nur ein Feature-Property) ausgetauscht wird.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const source = map.getSource(HIGHLIGHT_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const route = hoveredRouteId
      ? routesRef.current.find((r) => r.id === hoveredRouteId)
      : undefined;

    source.setData(
      route
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: route.geometry_geojson,
                properties: { color: resolveColor(colorsRef.current, route.id) },
              },
            ],
          }
        : { type: "FeatureCollection", features: [] },
    );
  }, [hoveredRouteId, routes]);

  // Aktualisiert die eingefärbten Stau-Abschnitte, sobald RouteDetailMap eine
  // neue Verkehrsabfrage abgeschlossen hat.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const source = map.getSource(TRAFFIC_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(toTrafficFeatureCollection(trafficSegments));
  }, [trafficSegments]);

  // Sichtbarkeit des Tempolimit-Layers reagiert auf den "Tempolimits
  // anzeigen"-Toggle, statt bei jedem Kartenaufbau neu (und nur einmalig)
  // entschieden zu werden — sonst bleibt ein späteres Umschalten wirkungslos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (!map.getLayer(SPEED_LINE_LAYER)) return;
    map.setLayoutProperty(SPEED_LINE_LAYER, "visibility", showSpeedLimits ? "visible" : "none");
  }, [showSpeedLimits]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (!map.getLayer(TRAFFIC_LINE_LAYER)) return;
    map.setLayoutProperty(TRAFFIC_LINE_LAYER, "visibility", showTraffic ? "visible" : "none");
  }, [showTraffic]);

  // Standort-Marker anzeigen/aktualisieren, sobald die Sidebar den Standort ermittelt hat.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      locationMarkerRef.current?.remove();
      locationMarkerRef.current = null;
      return;
    }

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setLngLat(userLocation);
    } else {
      locationMarkerRef.current = new mapboxgl.Marker({ element: createLocationDotElement() })
        .setLngLat(userLocation)
        .addTo(map);
    }
  }, [userLocation]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-muted/25 text-sm text-muted">
        NEXT_PUBLIC_MAPBOX_TOKEN fehlt in .env.local
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
