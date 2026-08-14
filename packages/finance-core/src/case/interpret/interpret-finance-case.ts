/**
 * Pure Case interpretation pipeline.
 * Input: FactSnapshot · Output: ephemeral CaseOutput
 * Signals never define verdict.
 */

import type { CaseFacts } from "../facts/fact-groups";
import {
  isAbsent,
  isKnown,
  isKnownPositiveMinor,
  isKnownZeroMinor,
  isUnknown,
} from "../facts/fact-tokens";
import type { CaseOutput, CaseReading } from "../output/case-output";
import {
  READING_PRIORITY,
  pickReadingByPrecedence,
  type CollisionCandidate,
} from "../rules/collision-precedence";
import { evaluateCompleteness } from "../rules/completeness";
import { detectConflicts, hasConflicts } from "../rules/conflicts";
import { generateConfidence } from "../rules/confidence";
import { resolveOwnership } from "../rules/ownership";
import { generatePosture } from "../rules/posture";
import type { FactSnapshot } from "../snapshot/fact-snapshot";

function proofProgressIs(
  facts: CaseFacts,
  value: "none" | "in_review" | "accepted" | "rejected"
): boolean {
  return isKnown(facts.evidence.proofProgress) && facts.evidence.proofProgress.value === value;
}

function intentNoneOrAbsent(facts: CaseFacts): boolean {
  if (isAbsent(facts.intent.intentSet)) {
    return true;
  }
  return isKnown(facts.intent.intentSet) && facts.intent.intentSet.value === "none";
}

function intentOpenKnown(facts: CaseFacts): boolean {
  return isKnown(facts.intent.intentOpen) && facts.intent.intentOpen.value === true;
}

function eligible(facts: CaseFacts): boolean {
  return (
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "eligible"
  );
}

function notEligible(facts: CaseFacts): boolean {
  return (
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "not_eligible"
  );
}

function closed(facts: CaseFacts): boolean {
  return (
    isKnown(facts.eligibility.lifecycleEligibility) &&
    facts.eligibility.lifecycleEligibility.value === "closed"
  );
}

function moneyDue(facts: CaseFacts): boolean {
  return (
    isKnown(facts.money.collectionPolicy) && facts.money.collectionPolicy.value === "money_due"
  );
}

function noMoneyDue(facts: CaseFacts): boolean {
  return (
    (isKnown(facts.money.collectionPolicy) &&
      facts.money.collectionPolicy.value === "no_money_due") ||
    (isKnownZeroMinor(facts.money.remaining) &&
      isKnown(facts.money.collectionPolicy) &&
      facts.money.collectionPolicy.value !== "money_due")
  );
}

function unsettled(facts: CaseFacts): boolean {
  return (
    isKnown(facts.settlement.settlementMeaning) &&
    facts.settlement.settlementMeaning.value === "unsettled"
  );
}

function captured(facts: CaseFacts): boolean {
  return (
    isKnown(facts.settlement.settlementMeaning) &&
    facts.settlement.settlementMeaning.value === "captured"
  );
}

function interpretationSentence(reading: CaseReading, decisionReady: boolean): string {
  switch (reading) {
    case "AWAITING_COUNTERPARTY":
      return "Money is due; no evidence in finance hands — waiting on the counterparty.";
    case "AWAITING_FINANCE":
      return decisionReady
        ? "Evidence and obligation are available for a finance decision."
        : "Evidence received. Finance review is next. Settlement may stay open.";
    case "NO_MONEY_DUE":
      return "No money is due for this subject — no payment chase.";
    case "NOT_ELIGIBLE":
      return "Money path is not open yet — product owns eligibility.";
    case "INTENT_OPEN_NO_PROOF":
      return "Open intent without in-review evidence — not finance review.";
    case "PARTIAL_SCOPED":
      return "Incomplete settlement with declared scope — counterparty next.";
    case "SETTLED_CAPTURED":
      return "Settlement captured — no outstanding finance move.";
    case "CLOSED_IDLE":
      return "Subject closed without unsafe leftover artifacts.";
    case "EXCEPTION":
      return "Product meaning conflicts with financial artifacts — routine review paused.";
    case "INCOMPLETE_INSPECT":
      return "Decisive facts are incomplete — inspect before deciding.";
    default: {
      const _exhaustive: never = reading;
      return _exhaustive;
    }
  }
}

function factsAreMostlyUnknown(facts: CaseFacts): boolean {
  return (
    isUnknown(facts.eligibility.lifecycleEligibility) &&
    isUnknown(facts.money.collectionPolicy) &&
    isUnknown(facts.money.remaining) &&
    isUnknown(facts.evidence.proofProgress) &&
    isUnknown(facts.intent.intentSet)
  );
}

function deriveReadingCandidates(
  facts: CaseFacts,
  conflictsPresent: boolean,
  completenessForcedInspect: boolean,
  signalOnly: boolean
): CollisionCandidate[] {
  const candidates: CollisionCandidate[] = [];

  if (conflictsPresent) {
    candidates.push({
      reading: "EXCEPTION",
      priority: READING_PRIORITY.EXCEPTION,
      reason: "conflict_cues",
    });
    return candidates;
  }

  if (signalOnly || completenessForcedInspect) {
    candidates.push({
      reading: "INCOMPLETE_INSPECT",
      priority: READING_PRIORITY.INCOMPLETE_INSPECT,
      reason: signalOnly ? "signal_only_incomplete_facts" : "completeness_inspect_forced",
    });
    if (signalOnly) {
      return candidates;
    }
  }

  if (notEligible(facts)) {
    candidates.push({
      reading: "NOT_ELIGIBLE",
      priority: READING_PRIORITY.NOT_ELIGIBLE,
      reason: "lifecycle_not_eligible",
    });
  }

  if (noMoneyDue(facts) && !isKnownPositiveMinor(facts.money.remaining) && !closed(facts)) {
    candidates.push({
      reading: "NO_MONEY_DUE",
      priority: READING_PRIORITY.NO_MONEY_DUE,
      reason: "collection_policy_or_zero",
    });
  }

  if (closed(facts) && !conflictsPresent) {
    const leftoversKnownFalse =
      isKnown(facts.exceptionCues.closedWithLeftoverArtifacts) &&
      facts.exceptionCues.closedWithLeftoverArtifacts.value === false;
    if (leftoversKnownFalse) {
      candidates.push({
        reading: "CLOSED_IDLE",
        priority: READING_PRIORITY.CLOSED_IDLE,
        reason: "closed_no_leftovers",
      });
    }
  }

  if (captured(facts) && !isKnownPositiveMinor(facts.money.remaining)) {
    if (proofProgressIs(facts, "accepted") || captured(facts)) {
      candidates.push({
        reading: "SETTLED_CAPTURED",
        priority: READING_PRIORITY.SETTLED_CAPTURED,
        reason: "settlement_captured",
      });
    }
  }

  if (eligible(facts) && moneyDue(facts)) {
    if (proofProgressIs(facts, "in_review")) {
      candidates.push({
        reading: "AWAITING_FINANCE",
        priority: READING_PRIORITY.AWAITING_FINANCE,
        reason: "proof_in_review",
      });
    } else if (
      isKnownPositiveMinor(facts.money.remaining) &&
      isKnown(facts.money.partialScopeDeclared) &&
      facts.money.partialScopeDeclared.value === true &&
      !proofProgressIs(facts, "in_review")
    ) {
      candidates.push({
        reading: "PARTIAL_SCOPED",
        priority: READING_PRIORITY.PARTIAL_SCOPED,
        reason: "partial_scoped_remaining",
      });
    } else if (
      intentOpenKnown(facts) &&
      !proofProgressIs(facts, "in_review") &&
      (proofProgressIs(facts, "none") ||
        isAbsent(facts.evidence.proofExists) ||
        proofProgressIs(facts, "rejected"))
    ) {
      candidates.push({
        reading: "INTENT_OPEN_NO_PROOF",
        priority: READING_PRIORITY.INTENT_OPEN_NO_PROOF,
        reason: "intent_open_no_in_review_proof",
      });
    } else if (
      intentNoneOrAbsent(facts) &&
      (proofProgressIs(facts, "none") ||
        isAbsent(facts.evidence.proofExists) ||
        proofProgressIs(facts, "rejected"))
    ) {
      candidates.push({
        reading: "AWAITING_COUNTERPARTY",
        priority: READING_PRIORITY.AWAITING_COUNTERPARTY,
        reason: "money_due_no_intent_no_proof",
      });
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      reading: "INCOMPLETE_INSPECT",
      priority: READING_PRIORITY.INCOMPLETE_INSPECT,
      reason: "no_rule_matched",
    });
  }

  return candidates;
}

function decisionReadyFacts(facts: CaseFacts, reading: CaseReading): boolean {
  if (reading !== "AWAITING_FINANCE") {
    return false;
  }
  return (
    eligible(facts) &&
    proofProgressIs(facts, "in_review") &&
    isKnown(facts.evidence.evidenceInspectable) &&
    facts.evidence.evidenceInspectable.value === true &&
    (isKnown(facts.money.remaining) || isKnown(facts.money.amountDue))
  );
}

/**
 * Pure interpreter — no I/O. CaseOutput is ephemeral interpretation only.
 */
export function interpretFinanceCase(snapshot: FactSnapshot): CaseOutput {
  const { facts, encounter } = snapshot;

  const completeness = evaluateCompleteness(facts);
  const conflicts = detectConflicts(facts);
  const conflictsPresent = hasConflicts(conflicts);

  const signalOnly =
    encounter.mode === "attention" &&
    encounter.attention !== undefined &&
    factsAreMostlyUnknown(facts);

  const completenessForcedInspect =
    completeness.class === "inspect_forced" && !conflictsPresent;

  const candidates = deriveReadingCandidates(
    facts,
    conflictsPresent,
    completenessForcedInspect,
    signalOnly
  );
  const picked = pickReadingByPrecedence(candidates);
  const reading = picked.reading;

  const reconMismatch =
    isKnown(facts.auditCues.reconFinding) && facts.auditCues.reconFinding.value === "mismatch";
  const auditAltitude =
    encounter.mode === "audit" || (reconMismatch && reading !== "EXCEPTION");

  const decisionReady = decisionReadyFacts(facts, reading);
  const ownership = resolveOwnership(reading, { auditAltitude });
  const posture = generatePosture({
    reading,
    completenessClass: completeness.class,
    auditAltitude,
    decisionReadyFacts: decisionReady,
  });

  const coexistenceUnsettled =
    reading === "AWAITING_FINANCE" && (unsettled(facts) || !isKnown(facts.settlement.settlementMeaning));

  const confidence = generateConfidence({
    reading,
    owner: ownership.owner,
    encounter,
    auditAltitude,
    decisionReady: posture.decisionReady,
    coexistenceUnsettled,
  });

  const lane = auditAltitude ? "audit" : reading === "EXCEPTION" ? "exception" : "daily";

  return {
    subjectId: facts.identity.subjectId,
    subjectKind: facts.identity.subjectKind,
    caseKey: facts.identity.caseKey,
    reading,
    interpretationSentence: interpretationSentence(reading, posture.decisionReady),
    decisionReady: posture.decisionReady,
    owner: ownership.owner,
    whyOwner: ownership.whyOwner,
    lane,
    primaryPosture: posture.primaryPosture,
    allow: posture.allow,
    forbid: posture.forbid,
    confidence,
    completenessClass: completeness.class,
    auditAltitude,
  };
}
