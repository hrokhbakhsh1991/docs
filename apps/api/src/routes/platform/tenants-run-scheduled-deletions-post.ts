import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import { processScheduledTenantDeletions } from "../../platform/process-scheduled-tenant-deletions.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
} from "../../platform/platform.errors.ts";

export async function handlePlatformTenantsRunScheduledDeletionsPost(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
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

  const result = await processScheduledTenantDeletions(ctx.actorId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
