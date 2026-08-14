/**
 * Derive registrant target from intake JSON without exposing the blob on list.
 * Missing / unknown → self (matches DB coalesce + uniqueness semantics).
 */
export function readRegistrantTargetFromIntake(
  intake: Readonly<Record<string, unknown>> | null | undefined
): "self" | "other" {
  return intake !== null &&
    intake !== undefined &&
    intake.registrantTarget === "other"
    ? "other"
    : "self";
}

/** Gate for owned other→self reclassify (portal POST self after identity hit). */
export function isOwnedActiveOtherReclassifyCandidate(input: {
  readonly submittedByUserId: string;
  readonly expectedSubmitterId: string;
  readonly status: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>> | null;
}): boolean {
  if (input.submittedByUserId !== input.expectedSubmitterId) {
    return false;
  }
  if (input.status === "cancelled" || input.status === "rejected") {
    return false;
  }
  return readRegistrantTargetFromIntake(input.registrationIntake) === "other";
}
