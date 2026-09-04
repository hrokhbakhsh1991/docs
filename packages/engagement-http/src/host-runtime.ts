import type { EngagementHttpHostPorts } from "./host-ports";

let configuredPorts: EngagementHttpHostPorts | null = null;

export function configureEngagementHttpHost(ports: EngagementHttpHostPorts): void {
  configuredPorts = ports;
}

export function resetEngagementHttpHostForTests(): void {
  configuredPorts = null;
}

export function getEngagementHttpHost(): EngagementHttpHostPorts {
  if (configuredPorts === null) {
    throw new Error("ENGAGEMENT_HTTP_HOST_NOT_CONFIGURED");
  }
  return configuredPorts;
}
