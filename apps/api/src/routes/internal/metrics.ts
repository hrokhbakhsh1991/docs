import type { IncomingMessage, ServerResponse } from "node:http";

import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import {
  assertOpsServiceJwt,
  OPS_SCOPE_METRICS_READ,
  readAuthorizationHeader,
} from "../../internal/verify-ops-service-jwt";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";
import { handleHttpError } from "../../middleware/error-interceptor";
import { formatPrometheusMetrics } from "../../observability/prometheus-format";
import { refreshOutboxQueueGaugesFromDb } from "../../outbox/outbox-pending-metrics";
import { refreshFinanceOpsGaugesFromDb } from "../../workspace-finance/finance-ops-metrics";

async function assertMetricsScrapeAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertOpsServiceJwt(readAuthorizationHeader(req), OPS_SCOPE_METRICS_READ);
    return;
  }
  assertProvisioningDevelopmentOnly();
}

export async function handleInternalMetrics(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertMetricsScrapeAllowed(req);
    await refreshOutboxQueueGaugesFromDb();
    await refreshFinanceOpsGaugesFromDb();
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.statusCode = 200;
    res.end(formatPrometheusMetrics());
  } catch (error) {
    handleHttpError(res, error);
  }
}
