import { configureEngagementHttpHost } from "@app-tour/engagement-http";

import { resolveEngagementServiceForTenant } from "../boot/lazy-engagement-service";
import type { EngagementService } from "../workspace-engagement/engagement.service";
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

configureEngagementHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  readEngagementRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody, rawBody };
  },
  resolveEngagementService: async (deps, auth) => {
    return resolveEngagementServiceForTenant(
      auth.tenantId,
      deps.engagementService as EngagementService | undefined,
    );
  },
  readIdempotencyKey,
  hashIdempotentRequest,
  runIdempotentHttpMutation,
  idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
});
