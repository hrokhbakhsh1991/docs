import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { checkTenantSitesHealth } from "../../platform/check-tenant-sites-health.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

export async function handlePlatformTenantsSitesCheck(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
): Promise<void> {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
  } catch (err: unknown) {
    if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return;
  }

  const results = await checkTenantSitesHealth(tenantId);
  if (!results) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ results }));
}
