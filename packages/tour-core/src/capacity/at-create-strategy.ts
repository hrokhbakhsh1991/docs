/**
 * At-create capacity strategy (DEC-CW-03 Option A).
 * Pure policy math for workspaces that assign terminal intake status during public registration POST.
 * Urban vocabulary (`confirmed` / `waitlist`) is preserved at the adapter boundary — not booking `approved`.
 */

export type AtCreateCapacityPolicy = "open" | "waitlist" | "closed";

export type AtCreateCapacityDecision =
  | { readonly kind: "accept"; readonly status: "confirmed" }
  | { readonly kind: "waitlist"; readonly status: "waitlist" }
  | {
      readonly kind: "reject";
      readonly code: "REGISTRATION_CAPACITY_EXCEEDED" | "REGISTRATION_CLOSED";
    };

export type AtCreateCapacityInput = {
  readonly tourCapacity: number | null;
  readonly acceptedSeats: number;
  readonly requestedPartySize: number;
  readonly policy: AtCreateCapacityPolicy;
};

/**
 * Sum party sizes for rows that consume capacity at create time.
 * Only `confirmed` rows count — `waitlist` rows do not consume seats (REG-01c).
 */
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
 * P5-E-N-002 / REG-01..02 — at-create capacity + waitlist decision.
 */
export function atCreateCapacityStrategy(input: AtCreateCapacityInput): AtCreateCapacityDecision {
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

/** @deprecated Use {@link atCreateCapacityStrategy} — compat alias for CW1-03 migration. */
export function resolveRegistrationCapacityDecision(
  input: AtCreateCapacityInput
): AtCreateCapacityDecision {
  return atCreateCapacityStrategy(input);
}
