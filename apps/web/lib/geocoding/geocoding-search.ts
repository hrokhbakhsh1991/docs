import { GeocodingProviderError, isProviderFailStatus } from "./geocoding-provider-error";
import { searchIranMountainLandmarks } from "./iran-mountain-landmarks";
import { fetchMapIrSearch } from "./map-ir";
import { fetchNeshanSearch } from "./neshan";
import { fetchNominatimSearch, type GeocodingSearchResult } from "./nominatim";

export const GEOCODING_SEARCH_LIMIT = 6;
export const GEOCODING_FALLBACK_LOG = "GEOCODING_PROVIDER_FAIL_SWITCHING_TO_FALLBACK";

type GeocodingProviderId = "neshan" | "mapir" | "nominatim";

function resolvePrimaryProvider(): GeocodingProviderId {
  if (process.env.NESHAN_API_KEY?.trim()) {
    return "neshan";
  }
  if (process.env.MAP_IR_TOKEN?.trim()) {
    return "mapir";
  }
  return "nominatim";
}

function coordKey(result: GeocodingSearchResult): string {
  return `${result.latitude.toFixed(4)}:${result.longitude.toFixed(4)}`;
}

/** Local landmark matches first; dedupe remote rows by rounded coordinates. */
export function mergeGeocodingResults(
  local: GeocodingSearchResult[],
  remote: GeocodingSearchResult[],
  limit = GEOCODING_SEARCH_LIMIT,
): GeocodingSearchResult[] {
  const seen = new Set<string>();
  const out: GeocodingSearchResult[] = [];
  for (const row of [...local, ...remote]) {
    const key = coordKey(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

async function fetchFromProvider(
  provider: GeocodingProviderId,
  query: string,
  limit: number,
): Promise<GeocodingSearchResult[]> {
  if (provider === "neshan") {
    const key = process.env.NESHAN_API_KEY?.trim();
    if (!key) {
      throw new GeocodingProviderError("neshan", 503);
    }
    return fetchNeshanSearch(query, key, { limit });
  }
  if (provider === "mapir") {
    const key = process.env.MAP_IR_TOKEN?.trim();
    if (!key) {
      throw new GeocodingProviderError("mapir", 503);
    }
    return fetchMapIrSearch(query, key, { limit });
  }
  return fetchNominatimSearch(query, { limit, countryCodes: "ir" });
}

function logProviderFallback(provider: GeocodingProviderId, err: unknown): void {
  const status = err instanceof GeocodingProviderError ? err.status : 0;
  if (status === 0 || isProviderFailStatus(status)) {
    console.warn(GEOCODING_FALLBACK_LOG, { provider, status });
  }
}

async function fetchNominatimFallback(query: string, limit: number): Promise<GeocodingSearchResult[]> {
  try {
    return await fetchNominatimSearch(query, { limit, countryCodes: "ir" });
  } catch {
    return [];
  }
}

/**
 * Resilient geocoding: static Iranian mountain dictionary + optional Neshan/Map.ir primary
 * with Nominatim fallback. Never throws — callers always get a merged result array.
 */
export async function searchGeocodingWithFallback(
  query: string,
  options?: { limit?: number },
): Promise<GeocodingSearchResult[]> {
  const limit = options?.limit ?? GEOCODING_SEARCH_LIMIT;
  const local = searchIranMountainLandmarks(query, limit);
  const primary = resolvePrimaryProvider();
  let remote: GeocodingSearchResult[] = [];

  try {
    remote = await fetchFromProvider(primary, query, limit);
  } catch (err) {
    logProviderFallback(primary, err);
    if (primary !== "nominatim") {
      remote = await fetchNominatimFallback(query, limit);
    }
  }

  return mergeGeocodingResults(local, remote, limit);
}
