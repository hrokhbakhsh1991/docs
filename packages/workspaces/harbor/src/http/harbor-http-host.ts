/**
 * Harbor product HTTP host contract and runtime slot (PSR-6c2…6c4).
 *
 * Kept as one Harbor-named thin adapter so proof workspaces do not grow a
 * Denali-parallel host-ports/host-runtime module pair.
 */
import type { BookingPublicPort } from "@app-tour/booking-http-contracts";
import {
  createWorkspaceHttpHostSlot,
  type CanonicalDocument,
  type WorkspaceProductHttpHostBasePorts,
  type WorkspaceTourStorePort,
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

const slot = createWorkspaceHttpHostSlot<HarborHttpHostPorts>({
  notConfiguredCode: "HARBOR_HTTP_HOST_NOT_CONFIGURED",
});

export function configureHarborHttpHost(ports: HarborHttpHostPorts): void {
  slot.configure(ports);
}

export function resetHarborHttpHostForTests(): void {
  slot.resetForTests();
}

export function getHarborHttpHost(): HarborHttpHostPorts {
  return slot.get();
}

/** PSR-6c2 — null until API configures (PSR-6c3). */
export function tryGetHarborHttpHost(): HarborHttpHostPorts | null {
  return slot.tryGet();
}

export type { BookingPublicPort };
