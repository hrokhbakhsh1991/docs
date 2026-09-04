/**
 * Idempotency-Key header contract for ticketing mutations — TKT-001 Phase 1.
 */

export const TICKETING_IDEMPOTENCY_HEADER = "idempotency-key" as const;

export type TicketingIdempotencyHeaderContract = {
  readonly headerName: typeof TICKETING_IDEMPOTENCY_HEADER;
  readonly minLength: 8;
  readonly maxLength: 128;
};

export const TICKETING_IDEMPOTENCY_CONTRACT: TicketingIdempotencyHeaderContract = {
  headerName: TICKETING_IDEMPOTENCY_HEADER,
  minLength: 8,
  maxLength: 128,
};

export function assertTicketingIdempotencyKeyPresent(
  key: string | undefined,
): asserts key is string {
  if (key === undefined || key.trim().length === 0) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  const trimmed = key.trim();
  if (
    trimmed.length < TICKETING_IDEMPOTENCY_CONTRACT.minLength ||
    trimmed.length > TICKETING_IDEMPOTENCY_CONTRACT.maxLength
  ) {
    throw new Error("ZOD_VALIDATION_FAILED: Idempotency-Key length invalid");
  }
}
