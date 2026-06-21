import type { IncomingMessage, ServerResponse } from "node:http";

import { appendPlatformAuditEventOutsideTx } from "../../platform/append-platform-audit-event-outside-tx.ts";
import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import { buildTenantGdprExport } from "../../platform/build-tenant-gdpr-export.ts";
import { PLATFORM_AUDIT_ACTION_TENANT_EXPORT_REQUESTED } from "../../platform/platform-audit-logger.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";
import { streamTenantGdprExportZip } from "../../platform/stream-tenant-gdpr-export-zip.ts";

export async function handlePlatformTenantsExportPost(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
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
    await appendPlatformAuditEventOutsideTx({
      action: PLATFORM_AUDIT_ACTION_TENANT_EXPORT_REQUESTED,
      entityType: "tenant",
      entityId: tenantId,
      actorId: ctx.actorId,
      metadata: {},
    });

    const bundle = await buildTenantGdprExport(tenantId);
    await streamTenantGdprExportZip(res, bundle);
  } catch (err: unknown) {
    if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
