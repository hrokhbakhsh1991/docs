import type { EntityManager } from "typeorm";

import type {
  RegistrationPayableRegistration,
  RegistrationPaymentIntentSnapshot,
} from "../registration-payment-intent.types";

export const REGISTRATION_READ_PORT = Symbol("REGISTRATION_READ_PORT");

export type CreateRegistrationPaymentIntentInput = {
  registration: RegistrationPayableRegistration;
  paymentProvider: string;
  providerPaymentId: string;
};

/**
 * Mediates registration-side payment intent creation without importing payments application services.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces — see MAP §61.
 */
export interface RegistrationReadPort {
  createPaymentIntentWithManager(
    manager: EntityManager,
    input: CreateRegistrationPaymentIntentInput
  ): Promise<RegistrationPaymentIntentSnapshot>;
}
