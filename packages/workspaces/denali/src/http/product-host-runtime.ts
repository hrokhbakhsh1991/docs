import type { DenaliProductHttpHostPorts } from "./product-host-ports";

let configuredPorts: DenaliProductHttpHostPorts | null = null;

export function configureDenaliProductHttpHost(ports: DenaliProductHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetDenaliProductHttpHostForTests(): void {
  configuredPorts = null;
}

export function getDenaliProductHttpHost(): DenaliProductHttpHostPorts {
  if (configuredPorts === null) {
    throw new Error("DENALI_PRODUCT_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}
