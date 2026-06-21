import type { IncomingMessage, ServerResponse } from "node:http";
import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import type { PlatformOpsUserRepository } from "../../platform/platform-ops-user.repository.ts";
import { parseCreatePlatformTenantBody } from "../../platform/create-platform-tenant.schema.ts";
import { toCreateTenantResponse } from "../../platform/create-tenant-response.dto.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";
import { runProvisionTenantSaga } from "../../platform/provision-tenant-saga.ts";
import {
  hashPlatformIdempotentRequest,
  readPlatformIdempotencyKey,
  runWithPlatformIdempotency,
} from "./tenants-create-idempotency.ts";

export async function handlePlatformTenantsCreate(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { auth?: { repository?: PlatformOpsUserRepository } } = {}
) {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, deps.auth);
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

  const idempotencyKey = readPlatformIdempotencyKey(req);
  if (!idempotencyKey) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "idempotency_key_required", code: "IDEMPOTENCY_KEY_REQUIRED" })
    );
    return;
  }

  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }

  const requestHash = hashPlatformIdempotentRequest(req.method || "POST", req.url || "", rawBody);

  try {
    const response = await runWithPlatformIdempotency(idempotencyKey, requestHash, async () => {
      const body = parseCreatePlatformTenantBody(JSON.parse(rawBody || "{}"));
      const result = await runProvisionTenantSaga({
        subdomain: body.subdomain,
        workspaceType: body.workspaceType,
        ownerPhone: body.ownerPhone,
        ownerName: body.ownerNameNote,
        actorId: ctx.actorId,
      });
      return toCreateTenantResponse(result);
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } catch (err: unknown) {
    if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (err as Error)?.message || "provision_failed" }));
  }
}

// Made with Bob
