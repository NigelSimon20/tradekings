"use client";

import type { Map as LeafletMap, MapOptions } from "leaflet";
import { useEffect, useRef, useState, type RefObject } from "react";

export type Leaflet = typeof import("leaflet");

/** Where every map opens: the whole of Zimbabwe. */
export const COUNTRY_CENTRE: [number, number] = [-19.0, 29.8];

/**
 * A Leaflet map in `element`, with OpenStreetMap tiles. Leaflet touches
 * `window` as it loads, so it is imported in the browser only; `ready` turns
 * true once it is there. `create` adds whatever the map needs (a layer for
 * pins, click handlers) and its result is kept alongside the map.
 */
export function useLeafletMap<Extra extends object>(
  element: RefObject<HTMLDivElement | null>,
  create: (L: Leaflet, map: LeafletMap) => Extra,
  start: { center: [number, number]; zoom: number } = { center: COUNTRY_CENTRE, zoom: 6 },
  options: MapOptions = { scrollWheelZoom: true },
) {
  const [ready, setReady] = useState(false);
  const leaflet = useRef<({ L: Leaflet; map: LeafletMap } & Extra) | null>(null);
  // The map is made once, with what it was first given.
  const setUp = useRef({ create, start, options });

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const { create: build, start: view, options: mapOptions } = setUp.current;
      const map = L.map(element.current, mapOptions).setView(view.center, view.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      leaflet.current = { L, map, ...build(L, map) };
      setReady(true);
    });
    return () => {
      cancelled = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
  }, [element]);

  return { ready, leaflet };
}
