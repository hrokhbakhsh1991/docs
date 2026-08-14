/**
 * Completeness evaluation — unknown blocks act; does not invent facts.
 */

import type { CaseFacts } from "../facts/fact-groups";
import { isKnown, isKnownPositiveMinor, isUnknown } from "../facts/fact-tokens";
import type { CompletenessClass } from "../output/case-output";

export type CompletenessResult = {
  readonly class: CompletenessClass;
  readonly reasons: readonly string[];
};

export function evaluateCompleteness(facts: CaseFacts): CompletenessResult {
  const reasons: string[] = [];

  if (isUnknown(facts.eligibility.lifecycleEligibility)) {
    reasons.push("eligibility_unknown");
  }
  if (isUnknown(facts.money.collectionPolicy) && isUnknown(facts.money.remaining)) {
    reasons.push("money_meaning_unknown");
  }

  const closed =
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "closed";
  if (closed && isUnknown(facts.exceptionCues.closedWithLeftoverArtifacts)) {
    reasons.push("closed_artifact_meaning_unknown");
  }

  const proofInReview =
    isKnown(facts.evidence.proofProgress) && facts.evidence.proofProgress.value === "in_review";
  if (proofInReview) {
    if (isUnknown(facts.money.remaining) && isUnknown(facts.money.amountDue)) {
      reasons.push("obligation_unknown_with_evidence");
    }
    if (isUnknown(facts.evidence.evidenceInspectable)) {
      reasons.push("evidence_inspectability_unknown");
    }
  }

  const scheduleSuggestsPartial =
    isKnown(facts.money.scheduleKind) &&
    (facts.money.scheduleKind.value === "installments" ||
      facts.money.scheduleKind.value === "cycle");

  if (
    scheduleSuggestsPartial &&
    isKnownPositiveMinor(facts.money.remaining) &&
    isUnknown(facts.money.partialScopeDeclared) &&
    !(
      isKnown(facts.evidence.proofProgress) &&
      facts.evidence.proofProgress.value === "in_review"
    )
  ) {
    reasons.push("partial_scope_unknown");
  }

  const conflictCue =
    (isKnown(facts.exceptionCues.meaningConflict) &&
      facts.exceptionCues.meaningConflict.value === true) ||
    (isKnown(facts.exceptionCues.closedWithLeftoverArtifacts) &&
      facts.exceptionCues.closedWithLeftoverArtifacts.value === true) ||
    (isKnown(facts.intent.duplicateOrParallelSuspected) &&
      facts.intent.duplicateOrParallelSuspected.value === true) ||
    (closed && isUnknown(facts.exceptionCues.closedWithLeftoverArtifacts));

  if (conflictCue && (closed || reasons.includes("closed_artifact_meaning_unknown"))) {
    return { class: "escalate_forced", reasons };
  }

  if (
    (isKnown(facts.exceptionCues.meaningConflict) &&
      facts.exceptionCues.meaningConflict.value === true) ||
    (isKnown(facts.intent.duplicateOrParallelSuspected) &&
      facts.intent.duplicateOrParallelSuspected.value === true) ||
    (isKnown(facts.exceptionCues.closedWithLeftoverArtifacts) &&
      facts.exceptionCues.closedWithLeftoverArtifacts.value === true)
  ) {
    return { class: "escalate_forced", reasons: [...reasons, "conflict_cues"] };
  }

  if (reasons.length > 0) {
    return { class: "inspect_forced", reasons };
  }

  const actReady =
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "eligible" &&
    proofInReview &&
    isKnown(facts.evidence.evidenceInspectable) &&
    facts.evidence.evidenceInspectable.value === true &&
    (isKnown(facts.money.remaining) || isKnown(facts.money.amountDue));

  if (actReady) {
    return { class: "act_complete", reasons: [] };
  }

  return { class: "wait_complete", reasons: [] };
}
