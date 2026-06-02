import { GeocodingProviderError } from "./geocoding-provider-error";
import type { GeocodingSearchResult } from "./nominatim";

const NESHAN_SEARCH_URL = "https://api.neshan.org/v1/search";
/** Tehran — reference point for Iran-wide mountain name search. */
const NESHAN_REF_LAT = 35.6892;
const NESHAN_REF_LNG = 51.389;

type NeshanSearchItem = {
  title?: string;
  address?: string;
  region?: string;
  location?: { x?: number; y?: number };
};

type NeshanSearchResponse = {
  items?: NeshanSearchItem[];
};

export function parseNeshanRows(body: unknown, limit = 6): GeocodingSearchResult[] {
  if (!body || typeof body !== "object") {
    return [];
  }
  const items = (body as NeshanSearchResponse).items;
  if (!Array.isArray(items)) {
    return [];
  }
  const out: GeocodingSearchResult[] = [];
  for (const item of items) {
    const lat = item?.location?.y;
    const lon = item?.location?.x;
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!title || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    const addressParts = [item.address, item.region].filter((p) => typeof p === "string" && p.trim());
    const addressText = addressParts.length > 0 ? addressParts.join("، ") : title;
    out.push({
      displayName: title,
      addressText,
      latitude: lat as number,
      longitude: lon as number,
    });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

export async function fetchNeshanSearch(
  query: string,
  apiKey: string,
  options?: { limit?: number },
): Promise<GeocodingSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const limit = options?.limit ?? 6;
  const params = new URLSearchParams({
    term: q,
    lat: String(NESHAN_REF_LAT),
    lng: String(NESHAN_REF_LNG),
  });
  const res = await fetch(`${NESHAN_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "Api-Key": apiKey,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GeocodingProviderError("neshan", res.status);
  }
  const json = (await res.json()) as unknown;
  return parseNeshanRows(json, limit);
}
