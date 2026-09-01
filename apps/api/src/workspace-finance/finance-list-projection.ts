/** Max payment rows loaded for registration invoice fact assembly. */
export const MAX_PAYMENTS_PER_REGISTRATION = 50;

/** Documented upper bound when scanning prepayment outbox rows (aggregate SQL preferred). */
export const MAX_PREPAYMENT_EVENTS_PER_REGISTRATION = 50;

/** PR23-D1 outstanding-balance candidate scan page size (memory driver parity). */
export const OUTSTANDING_BALANCE_CANDIDATE_PAGE_SIZE = 200;

/**
 * Max operator registrations enumerated per outstanding-balance AR sweep (Prisma).
 * Aligns with tenant-scale caps; memory driver pages until exhausted instead.
 */
export const MAX_OUTSTANDING_BALANCE_CANDIDATES_PER_TENANT = 10_000;

/** Finance exception E2 — cancelled payments per tenant (operator exception queue). */
export const MAX_FINANCE_CANCELLED_PAYMENTS_PER_TENANT = 500;
