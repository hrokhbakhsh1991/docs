import { createWorkspaceHttpHostSlot } from "@app-tour/workspace-sdk";

import type { HarborHttpHostPorts } from "./host-ports";

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
