export const URBAN_REGISTRATION_DUPLICATE = "URBAN_REGISTRATION_DUPLICATE" as const;

export class UrbanRegistrationDuplicateError extends Error {
  readonly code = URBAN_REGISTRATION_DUPLICATE;
  readonly httpStatus = 409 as const;

  constructor() {
    super(URBAN_REGISTRATION_DUPLICATE);
    this.name = "UrbanRegistrationDuplicateError";
  }
}

export function isUrbanRegistrationDuplicateError(
  error: unknown
): error is UrbanRegistrationDuplicateError {
  return (
    error instanceof UrbanRegistrationDuplicateError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === URBAN_REGISTRATION_DUPLICATE)
  );
}
