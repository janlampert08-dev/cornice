"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ZURICH_CENTER, DEFAULT_ZOOM } from "@/lib/constants";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const LINE_SOURCE = "picker-line";

export default function RoutePicker({
  waypoints,
  previewCoords,
  onPick,
}: {
  waypoints: [number, number][];
  previewCoords: [number, number][] | null;
  onPick: (point: [number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

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
    map.on("click", (e) => onPickRef.current([e.lngLat.lng, e.lngLat.lat]));

    map.on("load", () => {
      map.addSource(LINE_SOURCE, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: LINE_SOURCE,
        type: "line",
        source: LINE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3D5AFE", "line-width": 3 },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Nummerierte Marker je gesetztem Wegpunkt.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = waypoints.map((point, i) => {
      const el = document.createElement("div");
      el.textContent = String(i + 1);
      el.style.cssText =
        "background:#131316;color:#FAFAFA;width:22px;height:22px;display:flex;" +
        "align-items:center;justify-content:center;font:600 12px/1 Inter,sans-serif;" +
        (i === 0 ? "background:#3D5AFE;" : "");
      return new mapboxgl.Marker({ element: el }).setLngLat(point).addTo(map);
    });
  }, [waypoints]);

  // Vorschau-Route (echtes Strassenrouting) einzeichnen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(LINE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: previewCoords ?? [] },
    });
  }, [previewCoords]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-muted/25 text-sm text-muted">
        NEXT_PUBLIC_MAPBOX_TOKEN fehlt in .env.local
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
