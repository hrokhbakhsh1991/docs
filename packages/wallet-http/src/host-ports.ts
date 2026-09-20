import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { WalletServicePort } from "./wallet-service.port";

export type WalletRouteDeps = {
  readonly walletService?: WalletServicePort;
};

/** Host ports injected by apps/api — auth, JSON, idempotency. */
export type WalletHttpHostPorts = {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" },
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readWalletRequestBody: (
    req: IncomingMessage,
  ) => Promise<{ readonly parsedBody: unknown; readonly rawBody: string }>;
  readonly resolveWalletService: (
    deps: WalletRouteDeps,
    auth: TenantAuthContext,
  ) => Promise<WalletServicePort>;
  readonly readIdempotencyKey: (req: IncomingMessage) => string | undefined;
  readonly hashIdempotentRequest: (method: string, path: string, rawBody: string) => string;
  readonly runIdempotentHttpMutation: <T extends Record<string, unknown>>(
    tenantId: string,
    idempotencyKey: string,
    requestHash: string,
    execute: () => Promise<T>,
    options?: { readonly statusCode?: number },
  ) => Promise<T>;
  readonly idempotencyKeyRequiredCode: string;
};
