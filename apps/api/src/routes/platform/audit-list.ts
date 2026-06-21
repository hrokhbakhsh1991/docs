import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { listPlatformAuditEvents } from "../../platform/list-platform-audit-events.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

function parsePagination(url: string | undefined): { limit: number; offset: number } {
  const parsed = new URL(url ?? "http://local/platform/v1/audit", "http://local");
  const limitRaw = Number.parseInt(parsed.searchParams.get("limit") ?? "50", 10);
  const offsetRaw = Number.parseInt(parsed.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

export async function handlePlatformAuditList(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const { limit, offset } = parsePagination(req.url);
  const data = await listPlatformAuditEvents(limit, offset);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ...data, limit, offset }));
}
