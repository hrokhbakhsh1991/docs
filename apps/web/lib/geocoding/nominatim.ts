/** Nominatim (OpenStreetMap) geocoding result normalized for Denali location zones. */
export type GeocodingSearchResult = {
  displayName: string;
  addressText: string;
  latitude: number;
  longitude: number;
};

export type NominatimSearchRow = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

export function parseNominatimRows(rows: unknown, limit = 5): GeocodingSearchResult[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  const out: GeocodingSearchResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const r = row as NominatimSearchRow;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const displayName = typeof r.display_name === "string" ? r.display_name.trim() : "";
    if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    out.push({
      displayName,
      addressText: displayName,
      latitude: lat,
      longitude: lon,
    });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

export async function fetchNominatimSearch(
  query: string,
  options?: { limit?: number; countryCodes?: string },
): Promise<GeocodingSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const limit = options?.limit ?? 5;
  const params = new URLSearchParams({
    format: "json",
    q,
    limit: String(limit),
    addressdetails: "1",
  });
  if (options?.countryCodes) {
    params.set("countrycodes", options.countryCodes);
  }
  const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TourOps-Denali-Wizard/1.0 (location-picker)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`nominatim_search_failed:${res.status}`);
  }
  const json = (await res.json()) as unknown;
  return parseNominatimRows(json, limit);
}
