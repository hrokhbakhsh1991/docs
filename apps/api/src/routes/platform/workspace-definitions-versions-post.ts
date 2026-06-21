import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import { parsePublishPlatformWorkspaceDefinitionVersionBody } from "../../platform/publish-platform-workspace-definition-version.schema.ts";
import {
  publishPlatformWorkspaceDefinitionVersion,
} from "../../platform/publish-platform-workspace-definition-version.ts";
import {
  PlatformForbidden,
  PlatformRendererNotAllowed,
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

export async function handlePlatformWorkspaceDefinitionsVersionsPost(
  req: IncomingMessage,
  res: ServerResponse,
  definitionId: string
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
    const body = parsePublishPlatformWorkspaceDefinitionVersionBody(await readJsonBody(req));
    const published = await publishPlatformWorkspaceDefinitionVersion({
      definitionId,
      payload: body.payload,
      actorId: ctx.actorId,
    });
    if (!published) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
      return;
    }
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(published));
  } catch (err: unknown) {
    if (err instanceof PlatformRendererNotAllowed || (err as { code?: string })?.code === "PLATFORM_RENDERER_NOT_ALLOWED") {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "renderer_not_allowed", code: "PLATFORM_RENDERER_NOT_ALLOWED" }));
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
