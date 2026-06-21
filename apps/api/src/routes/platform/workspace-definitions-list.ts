import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { PlatformUnauthorized, PlatformForbidden } from "../../platform/platform.errors.ts";
import { listPlatformWorkspaceDefinitions } from "../../platform/list-platform-workspace-definitions.ts";

export async function handlePlatformWorkspaceDefinitionsList(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
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

  const items = await listPlatformWorkspaceDefinitions();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ items }));
}
