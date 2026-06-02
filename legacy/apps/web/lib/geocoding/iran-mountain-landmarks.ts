import type { GeocodingSearchResult } from "./nominatim";

export type IranMountainLandmark = {
  displayName: string;
  addressText: string;
  latitude: number;
  longitude: number;
  /** Normalized substrings; query matches when any keyword is contained in the query. */
  keywords: string[];
};

/** High-frequency Iranian mountaineering landmarks — static fallback when external APIs rate-limit. */
export const IRAN_MOUNTAIN_LANDMARKS: readonly IranMountainLandmark[] = [
  {
    displayName: "دماوند - بارگاه سوم",
    addressText: "دماوند، بارگاه سوم، البرز",
    latitude: 35.9519,
    longitude: 52.1094,
    keywords: ["دماوند", "بارگاه سوم", "بارگاه", "damavand"],
  },
  {
    displayName: "علم کوه - حصارچال",
    addressText: "علم کوه، حصارچال، مازندران",
    latitude: 36.9833,
    longitude: 51.4167,
    keywords: ["علم کوه", "علم", "حصارچال", "alam kuh", "alam"],
  },
  {
    displayName: "توچال - ایستگاه ۷",
    addressText: "توچال، ایستگاه ۷، تهران",
    latitude: 35.8858,
    longitude: 51.389,
    keywords: ["توچال", "ایستگاه ۷", "ایستگاه 7", "tochal"],
  },
  {
    displayName: "سبلان - پناهگاه شهید بهشتی",
    addressText: "کوه سبلان، اردبیل",
    latitude: 38.265,
    longitude: 48.293,
    keywords: ["سبلان", "sabalan"],
  },
  {
    displayName: "دنا - قله",
    addressText: "کوه دنا، کهگیلویه و بویراحمد",
    latitude: 30.955,
    longitude: 51.424,
    keywords: ["دنا", "dena"],
  },
  {
    displayName: "کلاردشت - هلن",
    addressText: "کلاردشت، هلن، مازندران",
    latitude: 36.5,
    longitude: 51.15,
    keywords: ["کلاردشت", "هلن", "kelardasht"],
  },
] as const;

export function normalizeGeocodingQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ");
}

function landmarkMatchesQuery(landmark: IranMountainLandmark, normalizedQuery: string): boolean {
  if (normalizedQuery.length < 2) {
    return false;
  }
  for (const raw of landmark.keywords) {
    const keyword = normalizeGeocodingQuery(raw);
    if (keyword.length < 2) {
      continue;
    }
    if (normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)) {
      return true;
    }
  }
  const display = normalizeGeocodingQuery(landmark.displayName);
  return display.includes(normalizedQuery) || normalizedQuery.includes(display);
}

export function searchIranMountainLandmarks(query: string, limit = 6): GeocodingSearchResult[] {
  const normalizedQuery = normalizeGeocodingQuery(query);
  if (normalizedQuery.length < 2) {
    return [];
  }
  const out: GeocodingSearchResult[] = [];
  for (const landmark of IRAN_MOUNTAIN_LANDMARKS) {
    if (!landmarkMatchesQuery(landmark, normalizedQuery)) {
      continue;
    }
    out.push({
      displayName: landmark.displayName,
      addressText: landmark.addressText,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
    });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}
