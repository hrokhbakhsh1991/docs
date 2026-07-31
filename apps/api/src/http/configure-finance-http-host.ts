import { configureFinanceHttpHost } from "@app-tour/finance-http";

import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service";
import type { FinanceService } from "../workspace-finance/finance.service";
import { enqueueScheduleItemWaivedAudit } from "../workspace-finance/enqueue-finance-schedule-audit";
import { uploadOperatorReceiptProof } from "../workspace-finance/finance-receipt-upload";
import { handleHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { runWithHttpRequestContext } from "./bind-request-context";
import {
  hashIdempotentRequest,
  IDEMPOTENCY_KEY_REQUIRED,
  readIdempotencyKey,
  runIdempotentHttpMutation,
} from "./http-idempotency";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "./json";

configureFinanceHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  readFinanceRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody, rawBody };
  },
  resolveFinanceService: async (deps, auth) => {
    return resolveFinanceServiceForTenant(
      auth.tenantId,
      deps.financeService as FinanceService | undefined
    );
  },
  readIdempotencyKey,
  hashIdempotentRequest,
  runIdempotentHttpMutation,
  idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
  uploadOperatorReceiptProof,
  enqueueScheduleItemWaivedAudit,
});
