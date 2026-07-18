/**
 * Application port — Finance list identity enrichment (Phase 1.6).
 * Implementations live under `infrastructure/` — FinanceService must not Service-Locate Booking.
 */

export type FinanceRegistrationDisplay = {
  readonly registrationId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly memberDisplayName: string;
};

/**
 * Batch load display rows for finance list `registrationContext`.
 * Missing registration ids are omitted (caller attaches null).
 */
export interface RegistrationDisplayPort {
  getByRegistrationIds(
    tenantId: string,
    registrationIds: readonly string[]
  ): Promise<ReadonlyMap<string, FinanceRegistrationDisplay>>;
}
