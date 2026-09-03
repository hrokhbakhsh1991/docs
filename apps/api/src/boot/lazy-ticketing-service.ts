import type { TicketingServicePort } from "@app-tour/ticketing-http";

import { createTicketingRepository } from "../workspace-ticketing/infrastructure/prisma-ticketing.repository";
import { createTicketingService } from "../workspace-ticketing/ticketing.service";

let ticketingServiceSingleton: TicketingServicePort | null = null;

export function resetLazyTicketingServiceForTests(): void {
  ticketingServiceSingleton = null;
}

export function resolveTicketingService(injected?: TicketingServicePort): TicketingServicePort {
  if (injected !== undefined) {
    return injected;
  }
  if (ticketingServiceSingleton === null) {
    ticketingServiceSingleton = createTicketingService({
      repository: createTicketingRepository(),
    });
  }
  return ticketingServiceSingleton;
}

export async function resolveTicketingServiceForTenant(
  _tenantId: string,
  injected?: TicketingServicePort,
): Promise<TicketingServicePort> {
  return resolveTicketingService(injected);
}
