/**
 * Denali obligation SoT → MoneyFacts.
 * Facts only — no NO_MONEY_DUE Case reading, ownership, or settlement verdicts.
 */

import type { DenaliObligationSource } from "./denali-case-read-sources";
import { knownFact, unknownFact } from "./fact-tokens";
import type { MoneyFacts } from "./portable-facts";
import { unknownMoneyFacts } from "./unknown-fact-groups";

function normalizeMinor(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : "0";
}

/**
 * Map Denali commercial obligation projection into portable MoneyFacts.
 */
export function mapDenaliObligationToMoneyFacts(source: DenaliObligationSource): MoneyFacts {
  if (source.readStatus === "failed") {
    return unknownMoneyFacts("obligation_read_failed");
  }
  if (source.readStatus === "missing") {
    return unknownMoneyFacts("obligation_sot_missing");
  }

  const collectionMode = source.collectionMode ?? "offline";

  if (collectionMode === "free") {
    const currency =
      source.currency !== null && source.currency !== undefined && source.currency.trim().length > 0
        ? knownFact(source.currency.trim().toUpperCase())
        : unknownFact("currency_unread");
    return {
      obligationPresent: knownFact(true),
      collectionPolicy: knownFact("no_money_due"),
      amountDue: knownFact("0"),
      remaining: knownFact("0"),
      currency,
      scheduleKind: knownFact("none"),
      partialScopeDeclared: knownFact(false),
    };
  }

  if (source.obligationMinor === null || source.obligationMinor === undefined) {
    return unknownMoneyFacts("obligation_amount_unread");
  }

  const amountDue = knownFact(normalizeMinor(source.obligationMinor));

  let remaining: MoneyFacts["remaining"];
  if (source.remainingMinor === null || source.remainingMinor === undefined) {
    remaining = unknownFact("remaining_unread");
  } else {
    remaining = knownFact(normalizeMinor(source.remainingMinor));
  }

  const currency =
    source.currency !== null && source.currency !== undefined && source.currency.trim().length > 0
      ? knownFact(source.currency.trim().toUpperCase())
      : unknownFact("currency_unread");

  let scheduleKind: MoneyFacts["scheduleKind"];
  if (source.scheduleKind === null || source.scheduleKind === undefined) {
    scheduleKind = knownFact("none");
  } else {
    scheduleKind = knownFact(source.scheduleKind);
  }

  let partialScopeDeclared: MoneyFacts["partialScopeDeclared"];
  if (source.partialScopeDeclared === null || source.partialScopeDeclared === undefined) {
    partialScopeDeclared = knownFact(false);
  } else {
    partialScopeDeclared = knownFact(source.partialScopeDeclared);
  }

  return {
    obligationPresent: knownFact(true),
    collectionPolicy: knownFact("money_due"),
    amountDue,
    remaining,
    currency,
    scheduleKind,
    partialScopeDeclared,
  };
}

/** Identity helper — opaque ids only; never branded Denali types. */
export function mapDenaliEnrollmentIdentity(input: {
  readonly caseKey: string;
  readonly subjectId: string;
  readonly counterpartyId: string;
}): {
  readonly subjectId: string;
  readonly subjectKind: "enrollment";
  readonly caseKey: string;
  readonly counterpartyId: string;
} {
  return {
    caseKey: input.caseKey,
    subjectId: input.subjectId,
    subjectKind: "enrollment",
    counterpartyId: input.counterpartyId,
  };
}
