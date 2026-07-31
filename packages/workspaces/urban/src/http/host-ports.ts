import type { IncomingMessage } from "node:http";
import type {
  TenantAuthContext,
  WorkspaceProductHttpHostBasePorts,
} from "@app-tour/workspace-sdk";

import type { UrbanTourStorePort } from "./ports/tour-store.port";
import type { UrbanExposureResolverPort } from "./ports/exposure-resolver.port";

export type UrbanProductRouteDeps = {
  readonly tourStore?: unknown;
  readonly exposureResolverPort?: UrbanExposureResolverPort;
};

export type UrbanHttpHostPorts = WorkspaceProductHttpHostBasePorts & {
  readonly resolveTenantContextFromRequest: (req: IncomingMessage) => Promise<TenantAuthContext>;
  readonly readUrbanSettingsRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly readUrbanRegistrationRequestBody: (req: IncomingMessage) => Promise<unknown>;
  readonly resolveTourStore: (deps: UrbanProductRouteDeps) => Promise<UrbanTourStorePort>;
  readonly resolveExposureResolverPort: (
    deps: UrbanProductRouteDeps
  ) => UrbanExposureResolverPort | undefined;
  readonly settings: {
    readonly resolveTenantThemeJsonById: (tenantId: string) => Promise<unknown>;
    readonly persistTenantTheme: (
      tenantId: string,
      theme: Record<string, unknown>
    ) => Promise<void>;
    readonly requireActiveTraceId: () => string;
  };
  readonly registration: {
    readonly assertPublicRegistrationThrottle: (clientIp: string | undefined) => Promise<void>;
    readonly readIdempotencyKey: (req: IncomingMessage) => string | undefined;
    readonly hashIdempotentRequest: (method: string, path: string, rawBody: string) => string;
    readonly runIdempotentHttpMutation: <T>(
      tenantId: string,
      idempotencyKey: string,
      requestHash: string,
      finish: () => Promise<T>
    ) => Promise<T>;
    readonly idempotencyKeyRequiredCode: string;
    readonly decideRegistrationStatus: (input: {
      readonly tourCapacity: number | null;
      readonly acceptedSeats: number;
      readonly requestedPartySize: number;
      readonly policy: "open" | "waitlist" | "closed";
    }) => "confirmed" | "waitlist";
  };
};
