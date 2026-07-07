import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsWriteRole } from "../../platform/assert-platform-ops-role.ts";
import { createPlatformWorkspaceDefinition } from "../../platform/create-platform-workspace-definition.ts";
import { parseCreatePlatformWorkspaceDefinitionBody } from "../../platform/create-platform-workspace-definition.schema.ts";
import {
  PlatformDefinitionConflict,
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

export async function handlePlatformWorkspaceDefinitionsPost(
  req: IncomingMessage,
  res: ServerResponse
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
    const body = parseCreatePlatformWorkspaceDefinitionBody(await readJsonBody(req));
    const definition = await createPlatformWorkspaceDefinition(body);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(definition));
  } catch (err: unknown) {
    if (err instanceof PlatformDefinitionConflict || (err as { code?: string })?.code === "PLATFORM_DEFINITION_CONFLICT") {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "conflict", code: "PLATFORM_DEFINITION_CONFLICT" }));
      return;
    }
    if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
