"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { scoreLabel } from "@/lib/scoring/labels";

// This module is only ever loaded in the browser (next/dynamic with ssr: false).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark";

export type MapDestination = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  score: number;
  rank: number | null;
  recommended: boolean;
};

export type AuroraMapProps = {
  origin: { lat: number; lon: number; label: string };
  destinations: MapDestination[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
  route?: [number, number][];
  camera?: { lat: number; lon: number; name: string } | null;
  /** Extra space kept clear at the bottom (e.g. for a card overlaid on the map). */
  insetBottom?: number;
  className?: string;
};

/** Score pills are ~60 px wide and anchored at their base, so leave room on every side. */
const fitOptions = (insetBottom: number) => ({ padding: { top: 70, bottom: 40 + insetBottom, left: 72, right: 72 }, maxZoom: 10, duration: 0 });

const MARKER_BASE =
  "flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold tabular shadow-lg backdrop-blur-md transition-transform duration-150 cursor-pointer";
const MARKER_TONE: Record<string, string> = {
  Excellent: "border-score-excellent/60 bg-night-900/90 text-score-excellent",
  Good: "border-score-good/50 bg-night-900/90 text-score-good",
  Fair: "border-score-fair/50 bg-night-900/90 text-score-fair",
  Poor: "border-score-poor/50 bg-night-900/90 text-score-poor",
  blocked: "border-danger/50 bg-night-900/90 text-danger line-through",
};
/** Applied to the inner pill only: MapLibre positions the outer element with `transform`, which `scale` would distort. */
const MARKER_SELECTED = "scale-125 ring-2 ring-white/70";
const RANK_CLASS = "flex h-4 min-w-4 items-center justify-center rounded-full bg-white/12 px-1 text-[10px] text-ink";

function markerElement(d: MapDestination, onSelect?: (id: string) => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "rounded-full";
  el.setAttribute(
    "aria-label",
    d.recommended ? `${d.rank ? `${d.rank}. ` : ""}${d.name}, viewing score ${d.score}` : `${d.name}, not recommended (road warning)`,
  );
  const pill = document.createElement("span");
  pill.className = `${MARKER_BASE} ${d.recommended ? MARKER_TONE[scoreLabel(d.score)] : MARKER_TONE.blocked}`;
  if (d.rank) {
    const rank = document.createElement("span");
    rank.className = RANK_CLASS;
    rank.textContent = String(d.rank);
    pill.appendChild(rank);
  }
  const score = document.createElement("span");
  score.textContent = String(d.score);
  pill.appendChild(score);
  el.appendChild(pill);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect?.(d.id);
  });
  return el;
}

function originElement(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "relative flex h-4 w-4 items-center justify-center";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `You: ${label}`);
  el.innerHTML =
    '<span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-glacier-300/30"></span><span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-glacier-300"></span>';
  return el;
}

function cameraElement(name: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-night-800/90 text-ink-muted";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `Road camera: ${name}`);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
  return el;
}

export default function AuroraMap({ origin, destinations, selectedId, onSelect, route, camera, insetBottom = 0, className = "" }: AuroraMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const extrasRef = useRef<Marker[]>([]);
  const boundsRef = useRef<LngLatBounds | null>(null);
  const userMovedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const insetRef = useRef(insetBottom);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
    insetRef.current = insetBottom;
  }, [onSelect, insetBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: STYLE_URL,
        center: [origin.lon, origin.lat],
        zoom: 8,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    // The basemap references a few sprite icons it doesn't ship; register blanks instead of warning.
    map.setMissingStyleImageResolver((id) => {
      if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    const fit = () => {
      if (boundsRef.current && !userMovedRef.current) map.fitBounds(boundsRef.current, fitOptions(insetRef.current));
    };
    map.on("dragstart", () => (userMovedRef.current = true));
    map.on("zoomstart", (e) => {
      if (e.originalEvent) userMovedRef.current = true;
    });
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      fit();
    });
    resizeObserver.observe(container);
    map.on("load", () => {
      fit();
      for (const [layer, prop, color] of [
        ["background", "background-color", "#04070d"],
        ["water", "fill-color", "#081221"],
      ] as const) {
        if (map.getLayer(layer)) map.setPaintProperty(layer, prop, color);
      }
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#04070d", "line-width": 7, "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#74e9b8", "line-width": 3, "line-opacity": 0.85 },
      });
      setLoaded(true);
    });
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      resizeObserver.disconnect();
      markers.clear();
      extrasRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [origin.lat, origin.lon]);

  // Destination + origin markers, and a view that fits them all.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const { marker } of markersRef.current.values()) marker.remove();
    markersRef.current.clear();
    for (const m of extrasRef.current) m.remove();
    extrasRef.current = [new Marker({ element: originElement(origin.label) }).setLngLat([origin.lon, origin.lat]).addTo(map)];

    const bounds = new LngLatBounds([origin.lon, origin.lat], [origin.lon, origin.lat]);
    for (const d of destinations) {
      const el = markerElement(d, (id) => onSelectRef.current?.(id));
      const marker = new Marker({ element: el, anchor: "bottom", offset: [0, -2] }).setLngLat([d.lon, d.lat]).addTo(map);
      markersRef.current.set(d.id, { marker, el });
      bounds.extend([d.lon, d.lat]);
    }
    boundsRef.current = bounds;
    userMovedRef.current = false;
    map.resize();
    map.fitBounds(bounds, fitOptions(insetRef.current));
  }, [destinations, origin.lat, origin.lon, origin.label]);

  // Selected destination styling.
  useEffect(() => {
    for (const [id, { el }] of markersRef.current) {
      const selected = id === selectedId;
      const pill = el.firstElementChild;
      for (const c of MARKER_SELECTED.split(" ")) pill?.classList.toggle(c, selected);
      el.classList.toggle("z-10", selected);
      el.setAttribute("aria-pressed", String(selected));
    }
  }, [selectedId, destinations]);

  // Route line and nearest useful camera for the selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("route") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: route && route.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }] : [],
    });
    const cameraMarker = camera ? new Marker({ element: cameraElement(camera.name) }).setLngLat([camera.lon, camera.lat]).addTo(map) : null;
    return () => {
      cameraMarker?.remove();
    };
  }, [route, camera, loaded]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-night-900 text-sm text-ink-subtle ${className}`}>
        The map can&apos;t be shown on this device.
      </div>
    );
  }
  return <div ref={containerRef} className={`h-full w-full ${className}`} role="region" aria-label="Map of recommended viewing spots" />;
}
