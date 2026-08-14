/**
 * Portable fact presence semantics — unknown ≠ absent ≠ zero.
 * Providers must not coerce read failures into absent or zero.
 */

/** Value could not be determined from SoT. */
export type UnknownFact = {
  readonly kind: "unknown";
  readonly reason?: string;
};

/** Successfully determined that the thing does not exist. */
export type AbsentFact = {
  readonly kind: "absent";
};

/** Successfully read a value (including numeric zero when applicable). */
export type KnownFact<T> = {
  readonly kind: "known";
  readonly value: T;
};

export type TriFact<T> = UnknownFact | AbsentFact | KnownFact<T>;

export type PresenceFact = UnknownFact | AbsentFact | KnownFact<true>;

export function unknownFact(reason?: string): UnknownFact {
  return reason !== undefined ? { kind: "unknown", reason } : { kind: "unknown" };
}

export function absentFact(): AbsentFact {
  return { kind: "absent" };
}

export function knownFact<T>(value: T): KnownFact<T> {
  return { kind: "known", value };
}

export function isUnknown(fact: { readonly kind: string }): fact is UnknownFact {
  return fact.kind === "unknown";
}

export function isAbsent(fact: { readonly kind: string }): fact is AbsentFact {
  return fact.kind === "absent";
}

export function isKnown<T>(fact: TriFact<T>): fact is KnownFact<T> {
  return fact.kind === "known";
}

/** Numeric minor-unit amount: known "0" is zero, not absent/unknown. */
export type AmountMinorFact = UnknownFact | KnownFact<string>;

export function isKnownZeroMinor(fact: AmountMinorFact): boolean {
  if (fact.kind !== "known") {
    return false;
  }
  const digits = fact.value.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) === BigInt(0);
  } catch {
    return false;
  }
}

export function isKnownPositiveMinor(fact: AmountMinorFact): boolean {
  if (fact.kind !== "known") {
    return false;
  }
  const digits = fact.value.replace(/\D/g, "");
  if (digits.length === 0) {
    return false;
  }
  try {
    return BigInt(digits) > BigInt(0);
  } catch {
    return false;
  }
}
