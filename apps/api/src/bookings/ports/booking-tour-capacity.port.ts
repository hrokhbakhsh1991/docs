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

  /**
   * Batch resolve for list enrichment — one storage round-trip preferred.
   * Missing / invalid tours map to `null`. Empty `tourIds` → `{}`.
   */
  resolveTourCapacityMaxMany(
    tenantId: string,
    tourIds: readonly string[]
  ): Promise<Readonly<Record<string, number | null>>>;

  /** Explicit operator expansion used by the Waitlist → Finance handoff. */
  readonly increaseTourCapacity?: (input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly delta: number;
  }) => Promise<{
    readonly previousCapacity: number;
    readonly nextCapacity: number;
  }>;
};
