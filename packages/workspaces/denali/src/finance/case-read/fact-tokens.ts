/**
 * Portable fact tokens — structural mirror of finance-core Case fact-tokens.
 * Owned here so Denali binders need no finance-core Case export.
 * Semantics: unknown ≠ absent ≠ known(zero).
 */

export type UnknownFact = {
  readonly kind: "unknown";
  readonly reason?: string;
};

export type AbsentFact = {
  readonly kind: "absent";
};

export type KnownFact<T> = {
  readonly kind: "known";
  readonly value: T;
};

export type TriFact<T> = UnknownFact | AbsentFact | KnownFact<T>;

export type PresenceFact = UnknownFact | AbsentFact | KnownFact<true>;

export type AmountMinorFact = UnknownFact | KnownFact<string>;

export function unknownFact(reason?: string): UnknownFact {
  return reason !== undefined ? { kind: "unknown", reason } : { kind: "unknown" };
}

export function absentFact(): AbsentFact {
  return { kind: "absent" };
}

export function knownFact<T>(value: T): KnownFact<T> {
  return { kind: "known", value };
}
