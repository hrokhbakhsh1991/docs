/**
 * Harbor product HTTP host ports (PSR-6c2…6c4).
 */
import type { BookingPublicPort } from "@app-tour/booking-http-contracts";
import type {
  CanonicalDocument,
  WorkspaceProductHttpHostBasePorts,
  WorkspaceTourStorePort,
} from "@app-tour/workspace-sdk";

export type HarborTourStorePort = WorkspaceTourStorePort<CanonicalDocument>;

export type HarborProductRouteDeps = {
  readonly tourStore?: unknown;
  readonly publicBookingPort?: BookingPublicPort;
};

export type HarborHttpHostPorts = WorkspaceProductHttpHostBasePorts & {
  readonly resolveTourStore: (
    deps: HarborProductRouteDeps,
  ) => Promise<HarborTourStorePort>;
  readonly resolvePublicBookingPort: (
    deps: HarborProductRouteDeps,
  ) => BookingPublicPort;
  readonly readHarborRegistrationRequestBody: (
    req: import("node:http").IncomingMessage,
  ) => Promise<unknown>;
};

export type { BookingPublicPort };
