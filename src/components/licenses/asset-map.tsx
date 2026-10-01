"use client";

import "leaflet/dist/leaflet.css";

import Link from "next/link";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { CloseIcon } from "@/components/ui/icons";
import { LICENSE_STATUS_META } from "@/lib/licenses/meta";
import { LOCATION_ASSET_TYPES, type LicenseStatus } from "@/lib/licenses/types";
import { formatDate } from "@/lib/date/dates";
import { TONE_CLASSES, TONE_COLORS } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

type Leaflet = typeof import("leaflet");

/** A location on the map, with what the summary card shows. */
export interface MapPoint {
  id: string;
  name: string;
  type: string;
  city: string;
  latitude: number;
  longitude: number;
  worstStatus: LicenseStatus | null;
  needsAction: number;
  licenses: { id: string; name: string; status: LicenseStatus; expiryDate: string | null }[];
}

const COUNTRY: [number, number] = [-19.0, 29.8];

const colourOf = (status: LicenseStatus | null) =>
  status ? TONE_COLORS[LICENSE_STATUS_META[status].tone].solid : TONE_COLORS.neutral.solid;

/**
 * The License Tracker's map: every location-based asset (warehouses,
 * factories, depots, sites, offices) as a pin coloured by its most urgent
 * license. Clicking one shows its licenses and the way into the asset.
 */
export function AssetMap({ points }: { points: MapPoint[] }) {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);

  const visible = useMemo(
    () => points.filter((point) => (!type || point.type === type) && (!status || point.worstStatus === status)),
    [points, type, status],
  );
  const selected = visible.find((point) => point.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const map = L.map(element.current, { scrollWheelZoom: true }).setView(COUNTRY, 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      leaflet.current = { L, map, layer: L.layerGroup().addTo(map) };
      setReady(true);
    });
    return () => {
      cancelled = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
  }, []);

  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, layer } = current;
    layer.clearLayers();
    for (const point of visible) {
      const pin = document.createElement("span");
      pin.className = cn("bb-pin", point.id === selectedId && "is-selected", point.needsAction > 0 && "needs-follow-up");
      pin.style.setProperty("--pin", colourOf(point.worstStatus));
      pin.style.setProperty("--ring", TONE_COLORS.critical.solid);
      // Built as text, never HTML: names come from the sheet.
      const tooltip = document.createElement("span");
      tooltip.textContent = `${point.name} · ${point.licenses.length} license(s)`;
      L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({ className: "bb-marker", html: pin, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: point.name,
        keyboard: true,
      })
        .bindTooltip(tooltip, { direction: "top", offset: [0, -10] })
        .on("click", () => setSelectedId(point.id))
        .addTo(layer);
    }
  }, [ready, visible, selectedId]);

  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current || !visible.length) return;
    const bounds = visible.map((point) => [point.latitude, point.longitude] as [number, number]);
    if (bounds.length === 1) current.map.setView(bounds[0], 13);
    else current.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [ready, visible]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <p className="mr-auto text-sm font-medium text-slate-900">
          Locations <span className="font-normal text-slate-500">· {visible.length} on the map</span>
        </p>
        <span className="w-full sm:w-48">
          <Select
            aria-label="Location type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            placeholder="All location types"
            options={LOCATION_ASSET_TYPES.map((value) => ({ value, label: value }))}
            className="py-1.5 text-xs"
          />
        </span>
        <span className="w-full sm:w-48">
          <Select
            aria-label="Most urgent license"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Any status"
            options={(Object.keys(LICENSE_STATUS_META) as LicenseStatus[]).map((value) => ({ value, label: LICENSE_STATUS_META[value].label }))}
            className="py-1.5 text-xs"
          />
        </span>
      </div>
      <div className="relative isolate h-[26rem] lg:h-[30rem]">
        <div ref={element} className="absolute inset-0 bg-slate-100" aria-label="Map of company locations" />

        <div className="pointer-events-none absolute top-3 right-3 z-[500] rounded-xl bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-card ring-1 ring-slate-200">
          {(["EXPIRED", "EXPIRING", "ACTIVE"] as LicenseStatus[]).map((value) => (
            <p key={value} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", TONE_CLASSES[LICENSE_STATUS_META[value].tone].dot)} />
              {value === "ACTIVE" ? "All current" : LICENSE_STATUS_META[value].label}
            </p>
          ))}
          <p className="mt-1 flex items-center gap-2 border-t border-slate-200 pt-1">
            <span className="size-2.5 rounded-full bg-white" style={{ boxShadow: `0 0 0 2px ${TONE_COLORS.critical.solid}` }} />
            Needs action
          </p>
        </div>

        {selected ? (
          <div className="absolute inset-x-3 bottom-3 z-[500] max-h-[70%] overflow-y-auto rounded-2xl bg-white p-4 shadow-panel ring-1 ring-slate-200 sm:right-auto sm:w-96">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">
                  {selected.type} · {selected.city}
                </p>
                <p className="font-display truncate text-base font-semibold text-slate-900">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close summary"
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
              {selected.licenses.length ? (
                selected.licenses.map((license) => (
                  <li key={license.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Link href={`/licenses/${encodeURIComponent(license.id)}`} className="min-w-0 text-sm text-slate-800 hover:text-brand-700 hover:underline">
                      <span className="block truncate">{license.name}</span>
                      <span className="block text-xs text-slate-500">Expires {formatDate(license.expiryDate)}</span>
                    </Link>
                    <span className={cn("size-2.5 shrink-0 rounded-full", TONE_CLASSES[LICENSE_STATUS_META[license.status].tone].dot)} title={LICENSE_STATUS_META[license.status].label} />
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-slate-500">No licenses recorded yet.</li>
              )}
            </ul>
            <div className="mt-3">
              <ButtonLink href={`/licenses/assets/${encodeURIComponent(selected.id)}`} size="sm">
                Open {selected.type.toLowerCase()}
              </ButtonLink>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
