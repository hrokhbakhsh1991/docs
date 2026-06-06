export class TourVersionConflictError extends Error {
  readonly code = "TOUR_VERSION_CONFLICT" as const;

  constructor() {
    super("TOUR_VERSION_CONFLICT");
    this.name = "TourVersionConflictError";
  }
}

export function isTourVersionConflictError(error: unknown): error is TourVersionConflictError {
  return error instanceof TourVersionConflictError;
}
