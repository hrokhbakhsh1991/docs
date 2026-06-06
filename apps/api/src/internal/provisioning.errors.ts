export class TenantProvisionConflictError extends Error {
  readonly code: string;

  constructor(code: "TENANT_ID_ALREADY_EXISTS" | "TENANT_SUBDOMAIN_ALREADY_EXISTS") {
    super(code);
    this.name = "TenantProvisionConflictError";
    this.code = code;
  }
}
