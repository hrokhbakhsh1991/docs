import type { BookingDto } from "@repo/types";

import {
  getRegistrationById as getRegistrationByIdFromLib,
  registrationsUseLiveApi,
} from "@/lib/services/registrations.service";

/**
 * Leader-review details endpoint adapter.
 * TODO: if/when backend moves this route or adds an aggregate detail endpoint,
 * switch implementation here only and keep hook/component contracts stable.
 */
export async function getRegistrationById(registrationId: string): Promise<BookingDto> {
  return getRegistrationByIdFromLib(registrationId);
}

export function registrationDetailsEndpointAvailable(): boolean {
  return registrationsUseLiveApi();
}

