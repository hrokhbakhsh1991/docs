import type { UrbanHttpHostPorts } from "./host-ports";

let configuredPorts: UrbanHttpHostPorts | null = null;

export function configureUrbanHttpHost(ports: UrbanHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetUrbanHttpHostForTests(): void {
  configuredPorts = null;
}

export function getUrbanHttpHost(): UrbanHttpHostPorts {
  if (configuredPorts === null) {
    throw new Error("URBAN_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}
