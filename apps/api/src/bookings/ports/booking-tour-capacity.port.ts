/**
 * Tour capacity ceiling authority — reads tour SoT, never trust client intake alone.
 */
export type BookingTourCapacityPort = {
  readonly kind: string;
  /**
   * Resolve tour canonical capacityMax for (tenantId, tourId).
   * Returns null when tour missing or capacityMax absent/invalid.
   */
  resolveTourCapacityMax(tenantId: string, tourId: string): Promise<number | null>;
};
