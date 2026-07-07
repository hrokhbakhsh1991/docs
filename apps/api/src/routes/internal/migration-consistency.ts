import type { IncomingMessage, ServerResponse } from "node:http";

import { runMigrationConsistencyCheck } from "../../health/migration-consistency-check";
import { getLastMigrationConsistencyReport } from "../../health/integration-subsystem-gate";
import { handleHttpError } from "../../middleware/error-interceptor";
import { sendJson } from "../../http/json";
import {
  assertOpsServiceJwt,
  OPS_SCOPE_METRICS_READ,
  readAuthorizationHeader,
} from "../../internal/verify-ops-service-jwt";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";

async function assertMigrationConsistencyProbeAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertOpsServiceJwt(readAuthorizationHeader(req), OPS_SCOPE_METRICS_READ);
  }
}

/**
 * GET /internal/consistency/migrations — structured migration/schema drift report.
 */
export async function handleMigrationConsistency(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertMigrationConsistencyProbeAllowed(req);
    const cached = getLastMigrationConsistencyReport();
    const report = cached ?? (await runMigrationConsistencyCheck());
    sendJson(res, report.ok ? 200 : 503, report);
  } catch (error) {
    handleHttpError(res, error);
  }
}
