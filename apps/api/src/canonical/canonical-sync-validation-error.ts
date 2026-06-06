/** Internal dual-write sync failure — client sees stable code only (E-11). */
export class CanonicalSyncValidationError extends Error {
  readonly code = "CANONICAL_SYNC_VALIDATION_FAILED" as const;

  constructor() {
    super("CANONICAL_SYNC_VALIDATION_FAILED");
    this.name = "CanonicalSyncValidationError";
  }
}

export function isCanonicalSyncValidationError(
  error: unknown
): error is CanonicalSyncValidationError {
  return error instanceof CanonicalSyncValidationError;
}
