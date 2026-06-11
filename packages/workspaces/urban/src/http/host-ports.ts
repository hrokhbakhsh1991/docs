import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { UrbanTourStorePort } from "./ports/tour-store.port";

export type UrbanProductRouteDeps = {
  readonly tourStore?: unknown;
};

export type UrbanHttpHostPorts = {
  readonly runWithHttpRequestContext: <T>(
    req: IncomingMessage,
    auth: TenantAuthContext,
    fn: () => Promise<T>,
    options?: { readonly rateLimit?: "read" | "write" }
  ) => Promise<T>;
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  readonly sendHttpError: (
    res: ServerResponse,
    status: number,
    body: { readonly error: string; readonly code: string }
  ) => void;
  readonly handleHttpError: (res: ServerResponse, error: unknown) => void;
  readonly resolveWorkspaceTypeForTenant: (tenantId: string) => Promise<string>;
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readUrbanSettingsRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly readUrbanRegistrationRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly resolveTourStore: (deps: UrbanProductRouteDeps) => Promise<UrbanTourStorePort>;
  readonly settings: {
    readonly resolveTenantThemeJsonById: (tenantId: string) => Promise<unknown>;
    readonly persistTenantTheme: (
      tenantId: string,
      theme: Record<string, unknown>
    ) => Promise<void>;
    readonly requireActiveTraceId: () => string;
  };
};
