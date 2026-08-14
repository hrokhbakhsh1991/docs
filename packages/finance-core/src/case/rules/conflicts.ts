/**
 * Conflict detection — unsafe commercial meaning before happy-path review.
 */

import type { CaseFacts } from "../facts/fact-groups";
import { isKnown, isUnknown } from "../facts/fact-tokens";

export type ConflictCode =
  | "closed_with_leftovers"
  | "closed_artifact_unknown"
  | "meaning_conflict"
  | "duplicate_parallel_intents"
  | "unscoped_partial";

export type ConflictSet = {
  readonly codes: readonly ConflictCode[];
};

export function detectConflicts(facts: CaseFacts): ConflictSet {
  const codes: ConflictCode[] = [];

  const closed =
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "closed";

  if (
    closed &&
    isKnown(facts.exceptionCues.closedWithLeftoverArtifacts) &&
    facts.exceptionCues.closedWithLeftoverArtifacts.value === true
  ) {
    codes.push("closed_with_leftovers");
  }

  if (closed && isUnknown(facts.exceptionCues.closedWithLeftoverArtifacts)) {
    codes.push("closed_artifact_unknown");
  }

  if (
    isKnown(facts.exceptionCues.meaningConflict) &&
    facts.exceptionCues.meaningConflict.value === true
  ) {
    codes.push("meaning_conflict");
  }

  if (
    isKnown(facts.intent.duplicateOrParallelSuspected) &&
    facts.intent.duplicateOrParallelSuspected.value === true
  ) {
    codes.push("duplicate_parallel_intents");
  }

  const remainingPositive =
    isKnown(facts.money.remaining) &&
    (() => {
      try {
        const digits = facts.money.remaining.value.replace(/\D/g, "");
        return digits.length > 0 && BigInt(digits) > BigInt(0);
      } catch {
        return false;
      }
    })();

  const proofInReview =
    isKnown(facts.evidence.proofProgress) && facts.evidence.proofProgress.value === "in_review";

  const scheduleSuggestsPartial =
    isKnown(facts.money.scheduleKind) &&
    (facts.money.scheduleKind.value === "installments" ||
      facts.money.scheduleKind.value === "cycle");

  // Full remaining on a one-shot obligation is not "unscoped partial".
  if (
    remainingPositive &&
    !proofInReview &&
    scheduleSuggestsPartial &&
    isKnown(facts.money.partialScopeDeclared) &&
    facts.money.partialScopeDeclared.value === false
  ) {
    codes.push("unscoped_partial");
  }

  return { codes };
}

export function hasConflicts(conflicts: ConflictSet): boolean {
  return conflicts.codes.length > 0;
}
