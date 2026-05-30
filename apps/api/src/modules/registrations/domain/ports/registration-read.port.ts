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
 */
export interface RegistrationReadPort {
  createPaymentIntent(
    input: CreateRegistrationPaymentIntentInput
  ): Promise<RegistrationPaymentIntentSnapshot>;
}

