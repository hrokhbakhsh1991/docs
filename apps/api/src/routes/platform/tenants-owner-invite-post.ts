import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import { resendPlatformTenantOwnerInvite } from "../../platform/platform-tenant-lifecycle.service.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

export async function handlePlatformTenantsOwnerInvitePost(
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
    const body = await readJsonBody(req);
    const phone = typeof body.phone === "string" ? body.phone : undefined;
    const invite = await resendPlatformTenantOwnerInvite({
      tenantId,
      actorId: ctx.actorId,
      phone,
    });
    if (!invite) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ invite }));
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
