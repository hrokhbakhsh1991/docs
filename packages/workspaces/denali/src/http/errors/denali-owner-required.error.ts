export const DENALI_OWNER_REQUIRED = "DENALI_OWNER_REQUIRED" as const;

export class DenaliOwnerRequiredError extends Error {
  readonly code = DENALI_OWNER_REQUIRED;
  readonly surface: string;

  constructor(surface: string) {
    super(DENALI_OWNER_REQUIRED);
    this.name = "DenaliOwnerRequiredError";
    this.surface = surface;
  }
}

export function isDenaliOwnerRequiredError(error: unknown): error is DenaliOwnerRequiredError {
  return (
    error instanceof DenaliOwnerRequiredError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === DENALI_OWNER_REQUIRED)
  );
}
