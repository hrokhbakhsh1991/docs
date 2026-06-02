export class TenantContextMissingError extends Error {
  readonly code = "TENANT_CONTEXT_MISSING" as const;

  constructor(message = "Trusted tenant context required but absent") {
    super(message);
    this.name = "TenantContextMissingError";
  }
}
