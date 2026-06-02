export const REGISTRATION_LOOKUP_PORT = Symbol("REGISTRATION_LOOKUP_PORT");

export type AuthenticatedBookingInput = {
  tourId: string;
  participantFullName: string;
  participantContactPhone: string;
  transportMode: string;
  entryMode: string;
  telegramUserId?: string;
  telegramUsername?: string;
};

/**
 * Narrow read surface for registration creation — decouples mutations from the query monolith.
 */
export interface IRegistrationLookupPort {
  resolveAuthenticatedBookingInput(tourId: string): Promise<AuthenticatedBookingInput>;
}
