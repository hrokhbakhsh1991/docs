import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import type { PlatformOpsUserRepository } from "../../platform/platform-ops-user.repository.ts";
import { toPlatformTenantDto } from "../../platform/platform-tenant.dto.ts";
import { startPlatformTenantOffboard } from "../../platform/start-platform-tenant-offboard.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
} from "../../platform/platform.errors.ts";

export async function handlePlatformTenantsOffboardPost(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  deps: {
    auth?: { repository?: PlatformOpsUserRepository };
    offboard?: Parameters<typeof startPlatformTenantOffboard>[1];
  } = {}
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, deps.auth);
    assertPlatformOpsOwnerRole(ctx);
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

  const updated = await startPlatformTenantOffboard(
    { tenantId, actorId: ctx.actorId },
    deps.offboard
  );
  if (!updated) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ tenant: toPlatformTenantDto(updated) }));
}
