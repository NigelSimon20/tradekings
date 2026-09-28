import "server-only";

import { getConfig } from "@/lib/config/env";

/**
 * Place search for the location picker, using Photon — search-as-you-type
 * over OpenStreetMap data (the same map the billboard map shows), free and
 * with no API key. Photon is built for suggestions while typing, which
 * OpenStreetMap's own Nominatim service does not allow. Results are cached
 * and requests are spaced out, to use the free service fairly.
 */

export interface PlaceResult {
  label: string;
  latitude: number;
  longitude: number;
}

const ENDPOINT = "https://photon.komoot.io/api/";
/** Zimbabwe, so a street name finds the Harare one before one elsewhere. */
const ZIMBABWE_BBOX = "25.2,-22.5,33.1,-15.6";
const CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED = 500;
const cache = new Map<string, { at: number; results: PlaceResult[] }>();

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** One request at a time, a little apart, however fast people type. */
function spaced<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + 300 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return work();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

/** "Samora Machel Avenue, Belvedere, Harare, Zimbabwe" from Photon's parts. */
export function describePlace(properties: Record<string, string | undefined>): string {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const parts = [
    properties.name,
    street,
    properties.district ?? properties.locality,
    properties.city ?? properties.county,
    properties.state,
    properties.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(", ");
}

async function query(text: string, bbox: string | null): Promise<PlaceResult[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", text);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "en");
  if (bbox) url.searchParams.set("bbox", bbox);

  const response = await spaced(() =>
    fetch(url, {
      headers: { "User-Agent": `TradeKingsBillboardTracker/1.0 (${getConfig().appUrl})` },
      signal: AbortSignal.timeout(8000),
    }),
  );
  if (!response.ok) throw new Error("The place search is not answering right now. Try again, or click on the map.");

  const body = (await response.json()) as { features?: PhotonFeature[] };
  return (body.features ?? [])
    .map((feature) => {
      const [longitude, latitude] = feature.geometry?.coordinates ?? [Number.NaN, Number.NaN];
      return { label: describePlace(feature.properties ?? {}), latitude, longitude };
    })
    .filter((place) => place.label && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

/** Places matching the text, looking in Zimbabwe first and then anywhere. */
export async function searchPlaces(text: string): Promise<PlaceResult[]> {
  const key = text.trim().toLowerCase().replace(/\s+/g, " ");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.results;

  let results = await query(key, ZIMBABWE_BBOX);
  if (!results.length) results = await query(key, null);

  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return results;
}
