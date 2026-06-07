export const URBAN_OWNER_REQUIRED = "URBAN_OWNER_REQUIRED" as const;

export class UrbanOwnerRequiredError extends Error {
  readonly code = URBAN_OWNER_REQUIRED;
  readonly surface: string;

  constructor(surface: string) {
    super(URBAN_OWNER_REQUIRED);
    this.name = "UrbanOwnerRequiredError";
    this.surface = surface;
  }
}

export function isUrbanOwnerRequiredError(error: unknown): error is UrbanOwnerRequiredError {
  return error instanceof UrbanOwnerRequiredError;
}
