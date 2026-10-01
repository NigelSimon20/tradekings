"use client";

import "leaflet/dist/leaflet.css";

import Image from "next/image";

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";

import { BillboardFlagBadges, BillboardStatusBadge, LeaseBadge } from "@/components/billboards/badges";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CloseIcon, PinIcon, SearchIcon } from "@/components/ui/icons";
import {
  EMPTY_BILLBOARD_FILTERS,
  LEASE_FILTER_OPTIONS,
  countActiveBillboardFilters,
  filterBillboards,
  type BillboardFilters,
} from "@/lib/billboards/filters";
import { BILLBOARD_STATUS_META } from "@/lib/billboards/meta";
import { filePreviewUrl } from "@/lib/files/files";
import { BILLBOARD_STATUSES, type EvaluatedBillboard } from "@/lib/billboards/types";
import { describeDays } from "@/lib/date/dates";
import { TONE_CLASSES, TONE_COLORS } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

type Leaflet = typeof import("leaflet");

/** Zimbabwe, for the moment before the markers are known. */
const COUNTRY_VIEW: [number, number] = [-19.0, 29.8];

const pinColour = (billboard: EvaluatedBillboard) =>
  TONE_COLORS[BILLBOARD_STATUS_META[billboard.status].tone].solid;

/**
 * The billboard tracker's front door: every site as a marker, a search and
 * filters beside it, and a summary card for the selected site with the way
 * into its full profile.
 */
export function BillboardMap({
  billboards,
  cities,
  focusId,
}: {
  billboards: EvaluatedBillboard[];
  cities: string[];
  /** Opens the map on this site, e.g. from a profile's "Map" button. */
  focusId?: string;
}) {
  const [filters, setFilters] = useState<BillboardFilters>(EMPTY_BILLBOARD_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  // Used once, on the first framing of the map.
  const pendingFocus = useRef(focusId);
  const [ready, setReady] = useState(false);

  const element = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);

  const visible = useMemo(() => filterBillboards(billboards, filters), [billboards, filters]);
  const selected = visible.find((billboard) => billboard.id === selectedId) ?? null;
  const unplaced = visible.filter((billboard) => !billboard.computed.hasLocation).length;

  // Leaflet touches `window` as it loads, so it is imported in the browser only.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const map = L.map(element.current, { scrollWheelZoom: true }).setView(COUNTRY_VIEW, 6);
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

  // Markers follow the search and the selection.
  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, layer } = current;
    layer.clearLayers();

    for (const billboard of visible) {
      if (billboard.latitude === null || billboard.longitude === null) continue;

      const pin = document.createElement("span");
      pin.className = cn(
        "bb-pin",
        billboard.id === selectedId && "is-selected",
        billboard.computed.needsFollowUp && "needs-follow-up",
      );
      pin.style.setProperty("--pin", pinColour(billboard));
      pin.style.setProperty("--ring", TONE_COLORS.critical.solid);

      // Built as text, never HTML: names come from the sheet.
      const tooltip = document.createElement("span");
      tooltip.textContent = `${billboard.id} · ${billboard.name}`;

      L.marker([billboard.latitude, billboard.longitude], {
        icon: L.divIcon({ className: "bb-marker", html: pin, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: billboard.name,
        keyboard: true,
        zIndexOffset: billboard.id === selectedId ? 1000 : 0,
      })
        .bindTooltip(tooltip, { direction: "top", offset: [0, -10] })
        .on("click", () => setSelectedId(billboard.id))
        .addTo(layer);
    }
  }, [ready, visible, selectedId]);

  // A new search re-frames the map around what it found.
  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const focus = visible.find((billboard) => billboard.id === pendingFocus.current);
    pendingFocus.current = undefined;
    if (focus?.latitude != null && focus.longitude != null) {
      current.map.setView([focus.latitude, focus.longitude], 15);
      return;
    }

    const points = visible
      .filter((billboard) => billboard.latitude !== null && billboard.longitude !== null)
      .map((billboard) => [billboard.latitude!, billboard.longitude!] as [number, number]);
    if (points.length === 1) current.map.setView(points[0], 14);
    else if (points.length > 1) current.map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }, [ready, visible]);

  const choose = (billboard: EvaluatedBillboard) => {
    setSelectedId(billboard.id);
    if (billboard.latitude !== null && billboard.longitude !== null) {
      leaflet.current?.map.flyTo([billboard.latitude, billboard.longitude], 15, { duration: 0.6 });
    }
  };

  const update = (patch: Partial<BillboardFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const activeFilters = countActiveBillboardFilters(filters);

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-10.5rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70 max-lg:order-2">
        <div className="space-y-2.5 border-b border-slate-100 p-3">
          <label className="relative block">
            <span className="sr-only">Search billboards</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              value={filters.q}
              onChange={(event) => update({ q: event.target.value })}
              placeholder="ID, road, area, city or brand"
              className="pl-9"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Select
              aria-label="Status"
              value={filters.status}
              onChange={(event) => update({ status: event.target.value })}
              placeholder="Any status"
              options={BILLBOARD_STATUSES.map((status) => ({ value: status, label: status }))}
              className="px-2 text-xs"
            />
            <Select
              aria-label="City or town"
              value={filters.city}
              onChange={(event) => update({ city: event.target.value })}
              placeholder="Any city"
              options={cities.map((city) => ({ value: city, label: city }))}
              className="px-2 text-xs"
            />
            <Select
              aria-label="Lease"
              value={filters.lease}
              onChange={(event) => update({ lease: event.target.value })}
              placeholder="Any lease"
              options={LEASE_FILTER_OPTIONS}
              className="px-2 text-xs"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {visible.length} of {billboards.length} billboards
              {unplaced ? ` · ${unplaced} not on the map` : ""}
            </span>
            {activeFilters ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_BILLBOARD_FILTERS)}
                className="cursor-pointer font-medium text-brand-700 hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <ul className="scroll-slim max-h-96 min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto lg:max-h-none">
          {visible.map((billboard) => (
            <li key={billboard.id}>
              <button
                type="button"
                onClick={() => choose(billboard)}
                aria-pressed={billboard.id === selectedId}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition-colors",
                  billboard.id === selectedId ? "bg-brand-50" : "hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    TONE_CLASSES[BILLBOARD_STATUS_META[billboard.status].tone].dot,
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{billboard.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {billboard.id} · {billboard.city}
                    {billboard.computed.hasLocation ? "" : " · no GPS"}
                  </span>
                </span>
                {billboard.computed.needsFollowUp ? (
                  <span
                    className={cn("mt-1 size-2 shrink-0 rounded-full", TONE_CLASSES.critical.dot)}
                    title="Needs follow-up"
                  />
                ) : null}
              </button>
            </li>
          ))}
          {!visible.length ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">No billboards match the search.</li>
          ) : null}
        </ul>
      </section>

      <section className="relative isolate min-h-[55vh] overflow-hidden rounded-2xl shadow-card ring-1 ring-slate-200/70 lg:min-h-0">
        <div ref={element} className="absolute inset-0 bg-slate-100" aria-label="Map of billboard sites" />

        <Legend />

        {selected ? (
          <SummaryCard billboard={selected} onClose={() => setSelectedId(null)} />
        ) : null}
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute top-3 right-3 z-[500] rounded-xl bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-card ring-1 ring-slate-200 backdrop-blur-sm">
      {BILLBOARD_STATUSES.map((status) => (
        <p key={status} className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", TONE_CLASSES[BILLBOARD_STATUS_META[status].tone].dot)} />
          {status}
        </p>
      ))}
      <p className="mt-1 flex items-center gap-2 border-t border-slate-200 pt-1">
        <span
          className="size-2.5 rounded-full bg-white"
          style={{ boxShadow: `0 0 0 2px ${TONE_COLORS.critical.solid}` }}
        />
        Needs follow-up
      </p>
    </div>
  );
}

function SummaryCard({ billboard, onClose }: { billboard: EvaluatedBillboard; onClose: () => void }) {
  const campaign = billboard.computed.currentCampaign;
  const directions =
    billboard.latitude !== null && billboard.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${billboard.latitude},${billboard.longitude}`
      : null;

  return (
    <div className="absolute inset-x-3 bottom-3 z-[500] overflow-hidden rounded-2xl bg-white p-4 shadow-panel ring-1 ring-slate-200 sm:right-auto sm:w-96">
      {billboard.computed.coverPhotoId ? (
        <div className="relative -mx-4 -mt-4 mb-3 aspect-[16/7] bg-slate-100">
          <Image
            src={filePreviewUrl({ id: billboard.computed.coverPhotoId })}
            alt={`${billboard.name} — latest site photo`}
            fill
            unoptimized
            sizes="24rem"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{billboard.id}</p>
          <p className="font-display truncate text-base font-semibold text-slate-900">{billboard.name}</p>
          <p className="truncate text-xs text-slate-500">{billboard.address || billboard.city}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close summary"
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <BillboardStatusBadge status={billboard.status} />
        <LeaseBadge status={billboard.computed.leaseStatus} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">On the board</dt>
          <dd className="font-medium text-slate-800">
            {campaign ? `${campaign.brand}${campaign.campaign ? ` — ${campaign.campaign}` : ""}` : "Vacant"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Lease ends</dt>
          <dd className="numeric font-medium text-slate-800">
            {billboard.leaseExpiry ? describeDays(billboard.computed.leaseDaysRemaining) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="font-medium text-slate-800">{billboard.type || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Responsible</dt>
          <dd className="truncate font-medium text-slate-800">{billboard.responsibleName || "—"}</dd>
        </div>
      </dl>

      {billboard.computed.needsFollowUp ? (
        <div className="mt-3">
          <BillboardFlagBadges flags={billboard.computed.flags} limit={3} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/billboards/${encodeURIComponent(billboard.id)}`} size="sm">
          Open profile
        </ButtonLink>
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary", "sm")}
          >
            <PinIcon className="size-3.5" />
            Directions
          </a>
        ) : null}
      </div>
    </div>
  );
}
