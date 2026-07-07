export const IMPERSONATION_READ_ONLY = "IMPERSONATION_READ_ONLY";

export class ImpersonationReadOnlyError extends Error {
  readonly code = IMPERSONATION_READ_ONLY;

  constructor(message = IMPERSONATION_READ_ONLY) {
    super(message);
    this.name = "ImpersonationReadOnlyError";
  }
}
