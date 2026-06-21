/** BFF geocoding search row shape (matches `/api/geocoding/search` JSON). */
export type GeocodingSearchResult = {
  readonly displayName: string;
  readonly addressText: string;
  readonly latitude: number;
  readonly longitude: number;
};
