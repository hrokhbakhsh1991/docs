import type { IncomingMessage, ServerResponse } from "node:http";

import { appendPlatformAuditEventOutsideTx } from "../../platform/append-platform-audit-event-outside-tx.ts";
import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import { listExpiringDomainSslHostnames } from "../../platform/count-expiring-domain-ssl.ts";
import { PLATFORM_AUDIT_ACTION_DOMAIN_SSL_EXPIRING } from "../../platform/platform-audit-logger.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
} from "../../platform/platform.errors.ts";

export async function handlePlatformDomainsRunSslExpiryCheckPost(
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

  try {
    const expiring = await listExpiringDomainSslHostnames(14);
    for (const hostname of expiring) {
      await appendPlatformAuditEventOutsideTx({
        action: PLATFORM_AUDIT_ACTION_DOMAIN_SSL_EXPIRING,
        entityType: "tenant_domain",
        entityId: hostname,
        actorId: ctx.actorId,
        metadata: { hostname },
      });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ expiring, audited: expiring.length }));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
