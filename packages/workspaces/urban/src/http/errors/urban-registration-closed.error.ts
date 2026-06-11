export const URBAN_REGISTRATION_CLOSED = "URBAN_REGISTRATION_CLOSED" as const;

export class UrbanRegistrationClosedError extends Error {
  readonly code = URBAN_REGISTRATION_CLOSED;

  constructor() {
    super(URBAN_REGISTRATION_CLOSED);
    this.name = "UrbanRegistrationClosedError";
  }
}

export function isUrbanRegistrationClosedError(error: unknown): error is UrbanRegistrationClosedError {
  return (
    error instanceof UrbanRegistrationClosedError ||
    (error instanceof Error && error.message === URBAN_REGISTRATION_CLOSED) ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === URBAN_REGISTRATION_CLOSED)
  );
}
