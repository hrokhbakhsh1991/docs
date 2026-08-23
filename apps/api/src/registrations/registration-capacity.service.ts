import {
  atCreateCapacityStrategy,
  resolveRegistrationCapacityDecision as resolveRegistrationCapacityDecisionCore,
  sumAcceptedRegistrationSeats as sumAcceptedRegistrationSeatsCore,
  type AtCreateCapacityDecision,
  type AtCreateCapacityInput,
  type AtCreateCapacityPolicy,
} from "@app-tour/tour-core";

export class RegistrationCapacityExceededError extends Error {
  readonly code = "REGISTRATION_CAPACITY_EXCEEDED" as const;
  readonly statusCode = 409 as const;

  constructor(message = "Registration exceeds tour seat capacity") {
    super(message);
    this.name = "RegistrationCapacityExceededError";
  }
}

export function isRegistrationCapacityExceededError(
  error: unknown
): error is RegistrationCapacityExceededError {
  return error instanceof RegistrationCapacityExceededError;
}

/** @deprecated Import from `@app-tour/tour-core` — Urban adapter compat re-export (CW1-03). */
export type RegistrationCapacityPolicy = AtCreateCapacityPolicy;

/** @deprecated Import from `@app-tour/tour-core` — Urban adapter compat re-export (CW1-03). */
export type RegistrationCapacityDecision = AtCreateCapacityDecision;

/** @deprecated Import from `@app-tour/tour-core` — Urban adapter compat re-export (CW1-03). */
export type ResolveRegistrationCapacityInput = AtCreateCapacityInput;

/** @deprecated Import {@link sumAcceptedRegistrationSeats} from `@app-tour/tour-core`. */
export const sumAcceptedRegistrationSeats = sumAcceptedRegistrationSeatsCore;

/** @deprecated Import {@link atCreateCapacityStrategy} from `@app-tour/tour-core`. */
export function resolveRegistrationCapacityDecision(
  input: ResolveRegistrationCapacityInput
): RegistrationCapacityDecision {
  return resolveRegistrationCapacityDecisionCore(input);
}

export function assertRegistrationCapacityDecision(
  decision: RegistrationCapacityDecision
): "confirmed" | "waitlist" {
  if (decision.kind === "reject") {
    if (decision.code === "REGISTRATION_CLOSED") {
      throw new Error("URBAN_REGISTRATION_CLOSED");
    }
    throw new RegistrationCapacityExceededError();
  }
  return decision.status;
}

/** Urban host adapter: maps tour-core at-create strategy output to workspace vocabulary. */
export function decideUrbanRegistrationStatus(
  input: ResolveRegistrationCapacityInput
): "confirmed" | "waitlist" {
  return assertRegistrationCapacityDecision(atCreateCapacityStrategy(input));
}
