/** Stable lookup provider keys for {@link LookupRegistry}. */
export const LOOKUP_PROVIDER_IDS = {
  destinationSearch: "destination.search",
} as const;

export type LookupProviderId =
  (typeof LOOKUP_PROVIDER_IDS)[keyof typeof LOOKUP_PROVIDER_IDS];
