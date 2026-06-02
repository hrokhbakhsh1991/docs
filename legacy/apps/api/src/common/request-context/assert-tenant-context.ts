import { TenantContextMissingError } from "../errors/tenant-context-missing.error";
import { type RequestContext, requestContextStorage } from "./request-context";

type TenantContext = RequestContext & { tenantId: string };

export function assertTenantContext(): TenantContext {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new TenantContextMissingError("Tenant context storage is unavailable");
  }

  const tenantId = context.tenantId?.trim();
  if (!tenantId) {
    throw new TenantContextMissingError("Tenant context is missing tenant_id");
  }

  return {
    ...context,
    tenantId
  };
}
