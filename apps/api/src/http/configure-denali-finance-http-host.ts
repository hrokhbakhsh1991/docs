import { configureDenaliFinanceHttpHost } from "@app-tour/workspace-denali/http";

import { resolveLazyFinanceService } from "../boot/lazy-finance-service";
import type { FinanceService } from "../denali-finance/finance.service";
import { handleHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { runWithHttpRequestContext } from "./bind-request-context";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "./json";

configureDenaliFinanceHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  readFinanceRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody };
  },
  resolveFinanceService: async (deps) => {
    const service = await resolveLazyFinanceService(
      deps.financeService as FinanceService | undefined
    );
    return service;
  },
});
