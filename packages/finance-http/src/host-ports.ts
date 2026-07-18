import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { FinanceServicePort } from "./finance-service.port";

export type FinanceRouteDeps = {
  readonly financeService?: FinanceServicePort;
};

/** Host ports injected by apps/api — auth, JSON, idempotency (unchanged behavior). */
export type FinanceHttpHostPorts = {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" }
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readFinanceRequestBody: (
    req: IncomingMessage
  ) => Promise<{ readonly parsedBody: unknown; readonly rawBody: string }>;
  /** Phase 1.5 C2A — compose from `auth.tenantId` (not boot workspace type). */
  readonly resolveFinanceService: (
    deps: FinanceRouteDeps,
    auth: TenantAuthContext
  ) => Promise<FinanceServicePort>;
  /** Phase 4B — Idempotency-Key required for prepay, approve, create payment, submit receipt. */
  readonly readIdempotencyKey: (req: IncomingMessage) => string | undefined;
  readonly hashIdempotentRequest: (method: string, path: string, rawBody: string) => string;
  readonly runIdempotentHttpMutation: <T extends Record<string, unknown>>(
    tenantId: string,
    idempotencyKey: string,
    requestHash: string,
    execute: () => Promise<T>,
    options?: { readonly statusCode?: number }
  ) => Promise<T>;
  readonly idempotencyKeyRequiredCode: string;
};

/** @deprecated Alias — Denali compat (Phase 1.4 Commit 2). */
export type DenaliFinanceHttpHostPorts = FinanceHttpHostPorts;
