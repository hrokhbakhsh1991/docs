import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody, sendJson } from "../../http/json";
import { handleHttpError } from "../../middleware/error-interceptor";
import { ProvisioningService, type ProvisionedTenant } from "../../internal/provisioning.service";
import { parseProvisionTenantBody } from "../../internal/provision-tenant.schema";

export type InternalTenantsRouteDeps = {
  readonly provisioningService: ProvisioningService;
};

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
 *
 * @deprecated Use {@link handlePlatformTenantsCreate} via `POST /platform/v1/tenants`
 * for platform ops club provisioning. This route remains for MAP 4.3 dev seed tests only.
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
    handleHttpError(res, error);
  }
}
