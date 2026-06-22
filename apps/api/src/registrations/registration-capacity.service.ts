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

export type RegistrationCapacityPolicy = "open" | "waitlist" | "closed";

export type RegistrationCapacityDecision =
  | { readonly kind: "accept"; readonly status: "confirmed" }
  | { readonly kind: "waitlist"; readonly status: "waitlist" }
  | { readonly kind: "reject"; readonly code: "REGISTRATION_CAPACITY_EXCEEDED" | "REGISTRATION_CLOSED" };

export type ResolveRegistrationCapacityInput = {
  readonly tourCapacity: number | null;
  readonly acceptedSeats: number;
  readonly requestedPartySize: number;
  readonly policy: RegistrationCapacityPolicy;
};

export function sumAcceptedRegistrationSeats(
  rows: readonly { readonly status: string; readonly partySize: number | null }[]
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status !== "confirmed") {
      continue;
    }
    total += row.partySize ?? 1;
  }
  return total;
}

/**
 * P5-E-N-002 — seat capacity + waitlist decision (REG-01..02).
 */
export function resolveRegistrationCapacityDecision(
  input: ResolveRegistrationCapacityInput
): RegistrationCapacityDecision {
  if (input.policy === "closed") {
    return { kind: "reject", code: "REGISTRATION_CLOSED" };
  }

  const partySize =
    Number.isInteger(input.requestedPartySize) && input.requestedPartySize > 0
      ? input.requestedPartySize
      : 1;

  if (input.tourCapacity === null) {
    return { kind: "accept", status: "confirmed" };
  }

  const remaining = input.tourCapacity - input.acceptedSeats;
  if (partySize <= remaining) {
    return { kind: "accept", status: "confirmed" };
  }

  if (input.policy === "waitlist") {
    return { kind: "waitlist", status: "waitlist" };
  }

  return { kind: "reject", code: "REGISTRATION_CAPACITY_EXCEEDED" };
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
