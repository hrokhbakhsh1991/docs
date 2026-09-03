import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { TicketingServicePort } from "./ticketing-service.port";

export type TicketingRouteDeps = {
  readonly ticketingService?: TicketingServicePort;
};

export type TicketingHttpHostPorts = {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" },
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly requireOperatorSession: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readTicketingRequestBody: (
    req: IncomingMessage,
  ) => Promise<{ readonly parsedBody: unknown; readonly rawBody: string }>;
  readonly resolveTicketingService: (
    deps: TicketingRouteDeps,
    auth: TenantAuthContext,
  ) => Promise<TicketingServicePort>;
  readonly readIdempotencyKey: (req: IncomingMessage) => string | undefined;
  readonly hashIdempotentRequest: (method: string, path: string, rawBody: string) => string;
  readonly runIdempotentHttpMutation: <T extends Record<string, unknown>>(
    tenantId: string,
    idempotencyKey: string,
    requestHash: string,
    execute: () => Promise<T>,
    options?: { readonly statusCode?: number },
  ) => Promise<T>;
  readonly assertTicketingIdempotencyKeyPresent: (key: string | undefined) => asserts key is string;
};
