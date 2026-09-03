import { configureTicketingHttpHost, type TicketingServicePort } from "@app-tour/ticketing-http";
import { assertTicketingIdempotencyKeyPresent } from "@app-tour/ticketing-http-contracts";

import { resolveTicketingServiceForTenant } from "../boot/lazy-ticketing-service";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { runWithHttpRequestContext } from "./bind-request-context";
import {
  hashIdempotentRequest,
  readIdempotencyKey,
  runIdempotentHttpMutation,
} from "./http-idempotency";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "./json";

configureTicketingHttpHost({
  runWithHttpRequestContext,
  sendJson,
  handleHttpError,
  resolveTenantContextFromRequest,
  requireOperatorSession,
  readTicketingRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = parseJsonBody(rawBody);
    return { parsedBody, rawBody };
  },
  resolveTicketingService: async (deps, auth) => {
    return resolveTicketingServiceForTenant(
      auth.tenantId,
      deps.ticketingService as TicketingServicePort | undefined,
    );
  },
  readIdempotencyKey,
  hashIdempotentRequest,
  runIdempotentHttpMutation,
  assertTicketingIdempotencyKeyPresent,
});
