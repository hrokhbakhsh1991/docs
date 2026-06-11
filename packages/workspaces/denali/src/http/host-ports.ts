import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { FinanceServicePort } from "./ports/finance-service.port";

export type FinanceRouteDeps = {
  readonly financeService?: FinanceServicePort;
};

export type DenaliFinanceHttpHostPorts = {
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
  ) => Promise<{ readonly parsedBody: unknown }>;
  readonly resolveFinanceService: (deps: FinanceRouteDeps) => Promise<FinanceServicePort>;
};
