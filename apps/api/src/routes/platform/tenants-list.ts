import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { toPlatformTenantDto } from "../../platform/platform-tenant.dto.ts";
import { PlatformTenantRepository } from "../../platform/platform-tenant.repository.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePagination(req: IncomingMessage): { limit: number; offset: number } {
  const url = new URL(req.url ?? "/", "http://platform.local");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const rawOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}

export async function handlePlatformTenantsList(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { repository?: PlatformTenantRepository } = {}
): Promise<void> {
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

  const { limit, offset } = parsePagination(req);
  const repository = deps.repository ?? new PlatformTenantRepository();
  const { items, total } = await repository.listPaginated(limit, offset);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      items: items.map(toPlatformTenantDto),
      total,
      limit,
      offset,
    })
  );
}
