/**
 * DEC-CW-01 Option B — dual registration persistence models with neutral orchestration predicates.
 * Wire status strings and tables remain workspace-native; no approved↔confirmed normalization.
 */
export type RegistrationCapacityStrategy = "operatorApproval" | "atCreate";

export type RegistrationLifecycleProfile = "bookingPipeline" | "atCreateTerminal";

export type RegistrationModelContract = {
  readonly strategy: RegistrationCapacityStrategy;
  readonly persistenceTable: string;
  readonly capacityConsumingStatus: string;
  readonly vocabulary: readonly string[];
  readonly lifecycleProfile: RegistrationLifecycleProfile;
};

/** Booking / operator-approval model (operator_registrations). */
export const BOOKING_REGISTRATION_MODEL: RegistrationModelContract = Object.freeze({
  strategy: "operatorApproval",
  persistenceTable: "operator_registrations",
  capacityConsumingStatus: "approved",
  vocabulary: Object.freeze([
    "pending",
    "approved",
    "waitlisted",
    "rejected",
    "cancelled",
  ]),
  lifecycleProfile: "bookingPipeline",
});

/** Urban at-create model (urban_registrations). */
export const URBAN_REGISTRATION_MODEL: RegistrationModelContract = Object.freeze({
  strategy: "atCreate",
  persistenceTable: "urban_registrations",
  capacityConsumingStatus: "confirmed",
  vocabulary: Object.freeze(["confirmed", "waitlist", "cancelled"]),
  lifecycleProfile: "atCreateTerminal",
});

export function registrationOccupiesSeat(
  contract: RegistrationModelContract | "booking" | "urban",
  status: string,
): boolean {
  const resolved =
    contract === "booking"
      ? BOOKING_REGISTRATION_MODEL
      : contract === "urban"
        ? URBAN_REGISTRATION_MODEL
        : contract;
  return status === resolved.capacityConsumingStatus;
}

export function registrationQueuedWithoutSeat(
  contract: RegistrationModelContract,
  status: string,
): boolean {
  if (contract.strategy === "operatorApproval") {
    return status === "waitlisted";
  }
  return status === "waitlist";
}

export function registrationAwaitingOperatorDecision(
  contract: RegistrationModelContract,
  status: string,
): boolean {
  return contract.strategy === "operatorApproval" && status === "pending";
}

export function registrationTerminalNegative(
  contract: RegistrationModelContract,
  status: string,
): boolean {
  return contract.strategy === "operatorApproval" && status === "rejected";
}

export function registrationVoided(
  contract: RegistrationModelContract,
  status: string,
): boolean {
  void contract;
  return status === "cancelled";
}
