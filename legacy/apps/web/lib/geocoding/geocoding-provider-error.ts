/** Thrown when an upstream geocoding HTTP provider returns a non-success response. */
export class GeocodingProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
  ) {
    super(`${provider}_search_failed:${status}`);
    this.name = "GeocodingProviderError";
  }
}

export function isProviderFailStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}
