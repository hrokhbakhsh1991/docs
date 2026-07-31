import { createWorkspaceHttpHostSlot } from "@app-tour/workspace-sdk";

import type { DenaliProductHttpHostPorts } from "./product-host-ports";

const slot = createWorkspaceHttpHostSlot<DenaliProductHttpHostPorts>({
  notConfiguredCode: "DENALI_PRODUCT_HTTP_HOST_NOT_CONFIGURED",
});

export function configureDenaliProductHttpHost(ports: DenaliProductHttpHostPorts): void {
  slot.configure(ports);
}

export function resetDenaliProductHttpHostForTests(): void {
  slot.resetForTests();
}

export function getDenaliProductHttpHost(): DenaliProductHttpHostPorts {
  return slot.get();
}
