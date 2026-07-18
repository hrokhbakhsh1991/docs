import { configureDenaliFinanceHttpHost } from "@app-tour/workspace-denali/http";

import { resolveLazyFinanceService } from "../boot/lazy-finance-service";
import type { FinanceService } from "../workspace-finance/finance.service";
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

configureDenaliFinanceHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  readFinanceRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody, rawBody };
  },
  resolveFinanceService: async (deps) => {
    const service = await resolveLazyFinanceService(
      deps.financeService as FinanceService | undefined
    );
    return service;
  },
  readIdempotencyKey,
  hashIdempotentRequest,
  runIdempotentHttpMutation,
  idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
});
