import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourRegistrationState = {
  readonly registrationUrl: string | null;
  readonly isSoldOut: boolean;
  readonly canRegister: boolean;
};

/** PR-D: sold-out when occupancy reports zero remaining seats. */
export function resolveCatalogTourRegistrationState(
  tour: MarketingCatalogCard,
  registrationUrl: string | null,
): CatalogTourRegistrationState {
  const isSoldOut = tour.spotsRemaining === 0;
  const hasUrl = registrationUrl != null && registrationUrl.trim().length > 0;
  return Object.freeze({
    registrationUrl: hasUrl ? registrationUrl.trim() : null,
    isSoldOut,
    canRegister: hasUrl && !isSoldOut,
  });
}
