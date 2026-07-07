import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import { toPlatformTenantDto } from "../../platform/platform-tenant.dto.ts";
import { updatePlatformTenantStatus } from "../../platform/platform-tenant-lifecycle.service.ts";
import { PlatformTenantRepository } from "../../platform/platform-tenant.repository.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";
import { parseUpdatePlatformTenantStatusBody } from "../../platform/update-platform-tenant-status.schema.ts";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

export async function handlePlatformTenantsStatusPatch(
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
    const body = parseUpdatePlatformTenantStatusBody(await readJsonBody(req));
    const repository = new PlatformTenantRepository();
    const existing = await repository.getById(tenantId);
    if (!existing) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    if (existing.status === "offboarding" && body.status === "active") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden", code: "TENANT_OFFBOARDING_USE_CANCEL" }));
      return;
    }
    const updated = await updatePlatformTenantStatus({
      tenantId,
      status: body.status,
      actorId: ctx.actorId,
      repository,
    });
    if (!updated) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ tenant: toPlatformTenantDto(updated) }));
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
