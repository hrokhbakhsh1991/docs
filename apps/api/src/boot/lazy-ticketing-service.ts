import type { TicketingServicePort } from "@app-tour/ticketing-http";

import { createTicketingRepository } from "../workspace-ticketing/infrastructure/prisma-ticketing.repository";
import { createTicketingOperationalRepository } from "../workspace-ticketing/infrastructure/ticketing-operational.repository";
import { HostTicketingCapabilityAdapter } from "../workspace-ticketing/infrastructure/host-ticketing-capability.adapter";
import type { TicketingCapabilityPort } from "../workspace-ticketing/infrastructure/host-ticketing-capability.adapter";
import { createTicketingService } from "../workspace-ticketing/ticketing.service";

let ticketingServiceSingleton: TicketingServicePort | null = null;
let sharedCapability: TicketingCapabilityPort | null = null;

function getSharedCapability(): TicketingCapabilityPort {
  if (sharedCapability === null) {
    sharedCapability = new HostTicketingCapabilityAdapter();
  }
  return sharedCapability as TicketingCapabilityPort;
}

export function resetLazyTicketingServiceForTests(): void {
  ticketingServiceSingleton = null;
  sharedCapability = null;
}

export function resolveTicketingService(injected?: TicketingServicePort): TicketingServicePort {
  if (injected !== undefined) {
    return injected;
  }
  if (ticketingServiceSingleton === null) {
    ticketingServiceSingleton = createTicketingService({
      repository: createTicketingRepository(),
      operationalRepository: createTicketingOperationalRepository(),
      capability: getSharedCapability(),
    });
  }
  return ticketingServiceSingleton;
}

export async function resolveTicketingServiceForTenant(
  tenantId: string,
  injected?: TicketingServicePort,
): Promise<TicketingServicePort> {
  if (injected !== undefined) {
    return injected;
  }
  await getSharedCapability().assertEnabled(tenantId);
  return resolveTicketingService();
}
