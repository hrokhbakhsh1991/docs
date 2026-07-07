import type { IncomingMessage, ServerResponse } from "node:http";
import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { listPlatformWorkspaces } from "../../platform/list-platform-workspaces.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

export async function handlePlatformWorkspaces(req: IncomingMessage, res: ServerResponse) {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
  } catch (err: any) {
    if (err instanceof PlatformUnauthorized || (err && err.code === "PLATFORM_UNAUTHORIZED")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return;
  }

  const data = listPlatformWorkspaces();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ workspaces: data }));
}
