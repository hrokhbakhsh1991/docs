import { createWorkspaceHttpHostSlot } from "@app-tour/workspace-sdk";

import type { UrbanHttpHostPorts } from "./host-ports";

const slot = createWorkspaceHttpHostSlot<UrbanHttpHostPorts>({
  notConfiguredCode: "URBAN_HTTP_HOST_NOT_CONFIGURED",
});

export function configureUrbanHttpHost(ports: UrbanHttpHostPorts): void {
  slot.configure(ports);
}

export function resetUrbanHttpHostForTests(): void {
  slot.resetForTests();
}

export function getUrbanHttpHost(): UrbanHttpHostPorts {
  return slot.get();
}
