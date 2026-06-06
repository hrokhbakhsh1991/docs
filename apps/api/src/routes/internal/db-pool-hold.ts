import type { IncomingMessage, ServerResponse } from "node:http";

import { withTenantRls } from "../../db/with-tenant-rls";
import { sendJson } from "../../http/json";
import { handleHttpError } from "../../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../../tenant-kernel/tenant-kernel";

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
    handleHttpError(res, error);
  }
}
