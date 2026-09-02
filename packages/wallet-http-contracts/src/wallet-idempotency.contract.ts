/**
 * Idempotency-Key header contract for wallet mutations (Phase 2D).
 */

export const WALLET_IDEMPOTENCY_HEADER = "idempotency-key" as const;

export type WalletIdempotencyHeaderContract = {
  /** Required on POST credit, debit, reversal. */
  readonly headerName: typeof WALLET_IDEMPOTENCY_HEADER;
  readonly minLength: 8;
  readonly maxLength: 128;
};

export const WALLET_IDEMPOTENCY_CONTRACT: WalletIdempotencyHeaderContract = {
  headerName: WALLET_IDEMPOTENCY_HEADER,
  minLength: 8,
  maxLength: 128,
};

export function assertWalletIdempotencyKeyPresent(
  key: string | undefined,
): asserts key is string {
  if (key === undefined || key.trim().length === 0) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  const trimmed = key.trim();
  if (
    trimmed.length < WALLET_IDEMPOTENCY_CONTRACT.minLength ||
    trimmed.length > WALLET_IDEMPOTENCY_CONTRACT.maxLength
  ) {
    throw new Error("ZOD_VALIDATION_FAILED: Idempotency-Key length invalid");
  }
}
