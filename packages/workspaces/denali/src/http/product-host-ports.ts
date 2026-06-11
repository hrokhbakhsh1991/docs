import type { IncomingMessage, ServerResponse } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { DenaliPublicBookingPort } from "./ports/public-booking.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

export type DenaliProductRouteDeps = {
  readonly tourStore?: unknown;
  readonly publicBookingPort?: DenaliPublicBookingPort;
};

export type DenaliProductHttpHostPorts = {
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
  readonly resolveTourStore: (deps: DenaliProductRouteDeps) => Promise<DenaliTourStorePort>;
  readonly readDenaliRegistrationRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly resolvePublicBookingPort: (deps: DenaliProductRouteDeps) => DenaliPublicBookingPort;
};
