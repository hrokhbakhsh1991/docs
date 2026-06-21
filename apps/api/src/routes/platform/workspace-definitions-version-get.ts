import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { getPlatformWorkspaceDefinitionVersion } from "../../platform/publish-platform-workspace-definition-version.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
} from "../../platform/platform.errors.ts";

export async function handlePlatformWorkspaceDefinitionsVersionGet(
  req: IncomingMessage,
  res: ServerResponse,
  definitionId: string,
  versionRaw: string
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

  const version = Number.parseInt(versionRaw, 10);
  if (!Number.isFinite(version) || version < 1) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const row = await getPlatformWorkspaceDefinitionVersion({ definitionId, version });
  if (!row) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(row));
}
