export type ShadowDeliveryParity = {
  readonly matches: boolean;
  readonly mismatches: readonly string[];
};

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStringRecord(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!sameStringArray(leftKeys, rightKeys)) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

export type AuthoritativeDeliveryFields = {
  readonly candidateFieldIds: readonly string[];
  readonly eligibleFieldIds: readonly string[];
  readonly fieldValues: Readonly<Record<string, string>>;
  readonly messageTemplate: string | null;
};

/**
 * Phase 3 field-dimension parity — shadow mirrors must match authoritative delivery inputs.
 */
export function resolveShadowDeliveryFieldParity(input: {
  readonly shadow: {
    readonly candidateFieldIds: readonly string[];
    readonly exposedFieldIds: readonly string[];
    readonly fieldValues: Readonly<Record<string, string>>;
    readonly templateOverrideId?: string;
  };
  readonly authoritative: AuthoritativeDeliveryFields;
}): ShadowDeliveryParity {
  const mismatches: string[] = [];

  if (!sameStringArray(input.shadow.candidateFieldIds, input.authoritative.candidateFieldIds)) {
    mismatches.push("candidate_field_ids");
  }
  if (!sameStringArray(input.shadow.exposedFieldIds, input.authoritative.eligibleFieldIds)) {
    mismatches.push("eligible_field_ids");
  }
  if (!sameStringRecord(input.shadow.fieldValues, input.authoritative.fieldValues)) {
    mismatches.push("field_values");
  }
  if ((input.shadow.templateOverrideId ?? null) !== input.authoritative.messageTemplate) {
    mismatches.push("message_template");
  }

  return {
    matches: mismatches.length === 0,
    mismatches,
  };
}
