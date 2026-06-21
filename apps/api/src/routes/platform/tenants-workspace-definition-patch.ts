import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";
import { PlatformTenantRepository } from "../../platform/platform-tenant.repository.ts";
import { parseUpdatePlatformTenantWorkspaceDefinitionBody } from "../../platform/update-platform-tenant-workspace-definition.schema.ts";
import { updatePlatformTenantWorkspaceDefinition } from "../../platform/update-platform-tenant-workspace-definition.ts";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

export async function handlePlatformTenantsWorkspaceDefinitionPatch(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
    assertPlatformOpsWriteRole(ctx);
  } catch (err: unknown) {
    if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
    return;
  }

  try {
    const patch = parseUpdatePlatformTenantWorkspaceDefinitionBody(await readJsonBody(req));
    const tenantRepository = new PlatformTenantRepository();
    const tenantExists = await tenantRepository.getById(tenantId);
    if (!tenantExists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    const workspaceDefinition = await updatePlatformTenantWorkspaceDefinition({
      tenantId,
      actorId: ctx.actorId,
      patch,
      tenantRepository,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ workspaceDefinition }));
  } catch (err: unknown) {
    if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
