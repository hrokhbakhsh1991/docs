import { configureWalletHttpHost } from "@app-tour/wallet-http";

import { resolveWalletServiceForTenant } from "../boot/lazy-wallet-service";
import type { WalletService } from "../workspace-wallet/wallet.service";
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

configureWalletHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  readWalletRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody, rawBody };
  },
  resolveWalletService: async (deps, auth) => {
    return resolveWalletServiceForTenant(
      auth.tenantId,
      deps.walletService as WalletService | undefined,
    );
  },
  readIdempotencyKey,
  hashIdempotentRequest,
  runIdempotentHttpMutation,
  idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
});
