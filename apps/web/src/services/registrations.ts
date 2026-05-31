import type { BookingDto } from "@repo/types";

import type { ApiRequestOptions } from "@/lib/api-client";

import {
  getRegistrationById as getRegistrationByIdFromLib,
  registrationsUseLiveApi,
} from "@/lib/services/registrations.service";

/**
 * Leader-review details endpoint adapter.
 * TODO: if/when backend moves this route or adds an aggregate detail endpoint,
 * switch implementation here only and keep hook/component contracts stable.
 */
export async function getRegistrationById(
  registrationId: string,
  options?: ApiRequestOptions,
): Promise<BookingDto> {
  return getRegistrationByIdFromLib(registrationId, options);
}

export function registrationDetailsEndpointAvailable(): boolean {
  return registrationsUseLiveApi();
}

