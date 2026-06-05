import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody, sendJson } from "../../http/json";
import { ProvisioningDevOnlyError } from "../../internal/provisioning-guard";
import { TenantProvisionConflictError } from "../../internal/provisioning.errors";
import { ProvisioningService, type ProvisionedTenant } from "../../internal/provisioning.service";
import { parseProvisionTenantBody } from "../../internal/provision-tenant.schema";

export type InternalTenantsRouteDeps = {
  readonly provisioningService: ProvisioningService;
};

function mapProvisionErrorToStatus(error: unknown): number {
  if (error instanceof ProvisioningDevOnlyError) return 403;
  if (error instanceof TenantProvisionConflictError) return 409;
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("ZOD_VALIDATION_FAILED")) return 400;
  if (message.startsWith("PROVISIONING_TENANT_ID_REQUIRED")) return 400;
  if (message.startsWith("PROVISIONING_TENANT_ID_INVALID_UUID")) return 400;
  if (message.startsWith("PROVISIONING_TENANT_ID_MISMATCH")) return 400;
  return 500;
}

function provisionResponseBody(tenant: ProvisionedTenant): Record<string, unknown> {
  return {
    id: tenant.id,
    subdomain: tenant.subdomain,
    workspaceType: tenant.workspaceType,
    status: tenant.status,
  };
}

/**
 * POST /internal/tenants/provision — development/non-production only (4.3-S2).
 */
export async function handleProvisionTenant(
  req: IncomingMessage,
  res: ServerResponse,
  deps: InternalTenantsRouteDeps
): Promise<void> {
  try {
    const rawBody = await readJsonBody<unknown>(req);
    const body = parseProvisionTenantBody(rawBody);
    const tenant = await deps.provisioningService.provisionTenant({
      tenantId: body.tenantId,
      subdomain: body.subdomain,
      workspaceType: body.workspaceType,
      status: body.status,
      theme: body.theme,
    });
    sendJson(res, 201, provisionResponseBody(tenant));
  } catch (error) {
    const status = mapProvisionErrorToStatus(error);
    if (status === 500) {
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
    const code =
      error instanceof TenantProvisionConflictError
        ? error.code
        : error instanceof ProvisioningDevOnlyError
          ? error.code
          : error instanceof Error
            ? error.message
            : "unknown_error";
    sendJson(res, status, { error: code });
  }
}
