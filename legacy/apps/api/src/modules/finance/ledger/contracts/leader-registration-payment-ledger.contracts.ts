/**
 * Finance ledger contracts for leader-driven registration payment adjustments.
 *
 * Intentionally **does not** import `registrations/*` — callers pass rows / payloads that
 * structurally satisfy these types (e.g. {@link RegistrationEntity}, {@link UpdateRegistrationPaymentDto}).
 */

/** Row shape the ledger reads/writes for payment projection (no ORM / Nest coupling). */
export type BookingLedgerLeaderRegistrationRow = {
  id: string;
  tenantId: string;
  quotedCurrencyCode?: string | null;
  paidAmount?: string;
  paymentStatus: string;
};

/** PATCH-shaped payload; `expected_row_version` is owned by the registrations API and ignored here. */
export type LeaderRegistrationPaymentPatchPayload = {
  paymentStatus: string;
  /** Leader PATCH: positive integer minor units. Receipt/capture may omit when ledger lines drive projection. */
  paidAmount?: number | string;
  expected_row_version?: number;
};
