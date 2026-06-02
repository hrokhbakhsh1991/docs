import { GeocodingProviderError } from "./geocoding-provider-error";
import type { GeocodingSearchResult } from "./nominatim";

const MAP_IR_AUTOCOMPLETE_URL = "https://map.ir/search/v2/autocomplete";

type MapIrGeom = {
  type?: string;
  coordinates?: [number, number];
};

type MapIrAutocompleteItem = {
  title?: string;
  address?: string;
  province?: string;
  geom?: MapIrGeom;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
};

type MapIrAutocompleteResponse = {
  value?: MapIrAutocompleteItem[];
  results?: MapIrAutocompleteItem[];
};

function itemToResult(item: MapIrAutocompleteItem): GeocodingSearchResult | null {
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) {
    return null;
  }
  let lat: number | undefined;
  let lon: number | undefined;
  const coords = item.geom?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    lon = Number(coords[0]);
    lat = Number(coords[1]);
  } else if (Number.isFinite(item.latitude) && Number.isFinite(item.longitude)) {
    lat = item.latitude as number;
    lon = item.longitude as number;
  } else if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
    lat = item.lat as number;
    lon = item.lon as number;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const addressParts = [item.address, item.province].filter((p) => typeof p === "string" && p.trim());
  const addressText = addressParts.length > 0 ? addressParts.join("، ") : title;
  return {
    displayName: title,
    addressText,
    latitude: lat as number,
    longitude: lon as number,
  };
}

export function parseMapIrRows(body: unknown, limit = 6): GeocodingSearchResult[] {
  if (!body || typeof body !== "object") {
    return [];
  }
  const payload = body as MapIrAutocompleteResponse;
  const items = Array.isArray(payload.value)
    ? payload.value
    : Array.isArray(payload.results)
      ? payload.results
      : [];
  const out: GeocodingSearchResult[] = [];
  for (const item of items) {
    const row = itemToResult(item);
    if (!row) {
      continue;
    }
    out.push(row);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

export async function fetchMapIrSearch(
  query: string,
  apiKey: string,
  options?: { limit?: number },
): Promise<GeocodingSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const limit = options?.limit ?? 6;
  const params = new URLSearchParams({ text: q });
  const res = await fetch(`${MAP_IR_AUTOCOMPLETE_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GeocodingProviderError("mapir", res.status);
  }
  const json = (await res.json()) as unknown;
  return parseMapIrRows(json, limit);
}
