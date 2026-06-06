import type { IncomingMessage, ServerResponse } from "node:http";

import { withTenantRls } from "../../db/with-tenant-rls";
import { sendJson } from "../../http/json";
import { resolveTenantContextFromRequest } from "../../tenant-kernel/tenant-kernel";

function mapHoldErrorToStatus(message: string): number {
  if (message.startsWith("UNAUTHORIZED_")) return 401;
  if (message.startsWith("FORBIDDEN_")) return 403;
  if (message.startsWith("INVALID_TENANT_AUTH_CONTEXT")) return 401;
  if (message.startsWith("DB_POOL_SATURATED")) return 503;
  return 500;
}

/**
 * GET /internal/test/db-pool-hold — NODE_ENV=test only; one RLS transaction (DEC-012 perf probe).
 */
export async function handleDbPoolHold(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    res.statusCode = 404;
    res.end();
    return;
  }

  try {
    const auth = await resolveTenantContextFromRequest(req);
    await withTenantRls(auth.tenantId, async (tx) => {
      await tx.$queryRaw`SELECT 1`;
    });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = mapHoldErrorToStatus(message);
    if (status === 503) {
      sendJson(res, 503, { error: "service_unavailable" });
      return;
    }
    if (status === 500) {
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
    sendJson(res, status, { error: message });
  }
}
