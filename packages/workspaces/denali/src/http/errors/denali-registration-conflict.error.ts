export const DENALI_REGISTRATION_DUPLICATE = "DENALI_REGISTRATION_DUPLICATE" as const;

export class DenaliRegistrationDuplicateError extends Error {
  readonly code = DENALI_REGISTRATION_DUPLICATE;
  readonly httpStatus = 409 as const;

  constructor() {
    super(DENALI_REGISTRATION_DUPLICATE);
    this.name = "DenaliRegistrationDuplicateError";
  }
}

export function isDenaliRegistrationDuplicateError(
  error: unknown
): error is DenaliRegistrationDuplicateError {
  return (
    error instanceof DenaliRegistrationDuplicateError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === DENALI_REGISTRATION_DUPLICATE)
  );
}
