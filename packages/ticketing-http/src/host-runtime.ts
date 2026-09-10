import type { TicketingHttpHostPorts } from "./host-ports";

let hostPorts: TicketingHttpHostPorts | null = null;

export function configureTicketingHttpHost(ports: TicketingHttpHostPorts): void {
  hostPorts = ports;
}

export function getTicketingHttpHost(): TicketingHttpHostPorts {
  if (hostPorts === null) {
    throw new Error("TICKETING_HTTP_HOST_NOT_CONFIGURED");
  }
  return hostPorts;
}

export function resetTicketingHttpHostForTests(): void {
  hostPorts = null;
}
