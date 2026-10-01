"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { MapIcon, PinIcon, SearchIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { TONE_COLORS } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export interface Point {
  latitude: number;
  longitude: number;
}

interface Place extends Point {
  label: string;
}

/** Zimbabwe, when there is nothing better to start from. */
const COUNTRY: Point = { latitude: -19.0, longitude: 29.8 };

/** Six decimal places is about 10cm — plenty for a billboard. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

export function googleMapsLink(point: Point): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

/**
 * "Pick on map" for the billboard form: search for a place, click or drag the
 * pin to the exact spot, or use the phone's own location when standing at the
 * site. The chosen point fills in the latitude and longitude.
 */
export function LocationPicker({
  value,
  suggestedSearch,
  onPick,
}: {
  value: Point | null;
  /** What the form already knows (road, area, city), offered as the first search. */
  suggestedSearch: () => string;
  onPick: (point: Point) => void;
}) {
  // The search text is read when the picker opens, so it reflects what has
  // been typed in the form by then.
  const [openWith, setOpenWith] = useState<string | null>(null);
  const open = openWith !== null;
  const setOpen = (next: boolean) => setOpenWith(next ? suggestedSearch() : null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="button" variant="subtle" size="sm" onClick={() => setOpen(true)}>
          <MapIcon className="size-4" />
          {value ? "Move the pin on the map" : "Pick on map"}
        </Button>
        {value ? (
          <a href={googleMapsLink(value)} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm")}>
            <PinIcon className="size-3.5" />
            View in Google Maps
          </a>
        ) : (
          <span className="text-xs text-slate-500">
            Don&rsquo;t know the coordinates? Search for the place and drop a pin — they fill in for you.
          </span>
        )}
      </div>

      {open ? (
        <PickerDialog
          initial={value}
          suggestedSearch={openWith ?? ""}
          onClose={() => setOpen(false)}
          onPick={(point) => {
            onPick(point);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PickerDialog({
  initial,
  suggestedSearch,
  onClose,
  onPick,
}: {
  initial: Point | null;
  suggestedSearch: string;
  onClose: () => void;
  onPick: (point: Point) => void;
}) {
  const [pin, setPin] = useState<Point | null>(initial);
  const [search, setSearch] = useState(suggestedSearch);
  const [places, setPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  // Where the map should go next (search result, "my location") — separate
  // from the pin so clicking around never makes the map jump.
  const [focus, setFocus] = useState<{ point: Point; zoom: number } | null>(
    initial ? { point: initial, zoom: 16 } : null,
  );

  // Only the newest search may show its results, however the answers arrive.
  const latestSearch = useRef(0);

  const findPlaces = async (text: string, announceEmpty: boolean) => {
    const ticket = ++latestSearch.current;
    setBusy("search");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`);
      const body = (await response.json()) as { ok?: boolean; error?: string; results?: Place[] };
      if (ticket !== latestSearch.current) return;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "The search did not work.");
      setPlaces(body.results ?? []);
      setMessage(
        announceEmpty && !body.results?.length ? "Nothing found. Try the road and town, or click on the map." : "",
      );
    } catch (error) {
      if (ticket === latestSearch.current) setMessage((error as Error).message);
    } finally {
      if (ticket === latestSearch.current) setBusy(null);
    }
  };

  // Suggestions while typing, once the person pauses — and straight away for
  // the road and town already filled in on the form.
  useEffect(() => {
    const text = search.trim();
    if (text.length < 3) return;
    const timer = setTimeout(() => void findPlaces(text, false), 450);
    return () => clearTimeout(timer);
  }, [search]);

  const searchNow = () => {
    const text = search.trim();
    if (text.length >= 3) void findPlaces(text, true);
  };

  /**
   * Enter searches straight away. The dialog sits inside the billboard form in
   * React's tree, so the key must go no further — otherwise Enter here would
   * submit (and save) the billboard.
   */
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      searchNow();
    }
    if (event.key === "Escape" && places.length) {
      event.stopPropagation();
      setPlaces([]);
    }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setMessage("This browser cannot share its location.");
      return;
    }
    setBusy("locate");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: round(position.coords.latitude), longitude: round(position.coords.longitude) };
        setPin(point);
        setFocus({ point, zoom: 17 });
        setBusy(null);
      },
      () => {
        setMessage("Your location could not be read. Allow location for this site, or search instead.");
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const choosePlace = (place: Place) => {
    const point = { latitude: round(place.latitude), longitude: round(place.longitude) };
    setPin(point);
    setFocus({ point, zoom: 17 });
    setPlaces([]);
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Pin the billboard's location"
      description="Search for the place, then click the exact spot or drag the pin. Zoom in for accuracy."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="numeric text-xs text-slate-500">
            {pin ? `${pin.latitude}, ${pin.longitude}` : "No pin yet — click on the map."}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!pin} onClick={() => pin && onPick(pin)}>
              Use this location
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Deliberately not a <form>: it would be nested in the billboard form. */}
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search for a place</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value.trim().length < 3) setPlaces([]);
              }}
              onKeyDown={onSearchKey}
              placeholder="Start typing a road, place or town"
              autoComplete="off"
              aria-autocomplete="list"
              className="pl-9"
            />
          </label>
          <Button type="button" variant="secondary" onClick={searchNow} disabled={search.trim().length < 3}>
            {busy === "search" ? "Searching…" : "Search"}
          </Button>
          <Button type="button" variant="secondary" onClick={useMyLocation} disabled={busy !== null}>
            <PinIcon className="size-4" />
            {busy === "locate" ? "Finding you…" : "Use my location"}
          </Button>
        </div>

        {places.length ? (
          <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
            {places.map((place) => (
              <li key={`${place.latitude},${place.longitude},${place.label}`}>
                <button
                  type="button"
                  onClick={() => choosePlace(place)}
                  className="w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand-50"
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {message ? <Alert tone="caution">{message}</Alert> : null}

        <PickerMap pin={pin} focus={focus} onPin={setPin} />
      </div>
    </Modal>
  );
}

type Leaflet = typeof import("leaflet");

/** The map inside the dialog. Leaflet loads in the browser only. */
function PickerMap({
  pin,
  focus,
  onPin,
}: {
  pin: Point | null;
  focus: { point: Point; zoom: number } | null;
  onPin: (point: Point) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: Leaflet; map: LeafletMap; marker: Marker | null } | null>(null);
  const [ready, setReady] = useState(false);
  // The latest callback, without re-creating the map when it changes.
  const onPinRef = useRef(onPin);
  useEffect(() => {
    onPinRef.current = onPin;
  }, [onPin]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const start = focus ?? { point: COUNTRY, zoom: 6 };
      const map = L.map(element.current).setView([start.point.latitude, start.point.longitude], start.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      map.on("click", (event) =>
        onPinRef.current({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) }),
      );
      leaflet.current = { L, map, marker: null };
      // The dialog animates open; measure the map once it has its size.
      setTimeout(() => map.invalidateSize(), 150);
      setReady(true);
    });
    return () => {
      cancelled = true;
      leaflet.current?.map.remove();
      leaflet.current = null;
    };
    // The map is created once; later focus changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pin follows the chosen point, and can be dragged.
  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    if (!pin) {
      current.marker?.remove();
      current.marker = null;
      return;
    }
    if (!current.marker) {
      const dot = document.createElement("span");
      dot.className = cn("bb-pin", "is-selected");
      dot.style.setProperty("--pin", TONE_COLORS.critical.solid);
      current.marker = current.L.marker([pin.latitude, pin.longitude], {
        draggable: true,
        icon: current.L.divIcon({ className: "bb-marker", html: dot, iconSize: [22, 22], iconAnchor: [11, 11] }),
      })
        .on("dragend", (event) => {
          const at = (event.target as Marker).getLatLng();
          onPinRef.current({ latitude: round(at.lat), longitude: round(at.lng) });
        })
        .addTo(current.map);
    } else {
      current.marker.setLatLng([pin.latitude, pin.longitude]);
    }
  }, [ready, pin]);

  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current || !focus) return;
    current.map.flyTo([focus.point.latitude, focus.point.longitude], focus.zoom, { duration: 0.6 });
  }, [ready, focus]);

  return (
    <div className="relative isolate h-[55vh] min-h-72 overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div ref={element} className="absolute inset-0 bg-slate-100" aria-label="Map — click to place the pin" />
    </div>
  );
}
