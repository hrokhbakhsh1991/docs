/**
 * PR15-D — Report-only Encounter fact coverage diagnostics.
 * Observational: never mutates SoTs, never changes interpreter verdicts,
 * never coerces unknown → zero/absent.
 */

import {
  isAbsent,
  isKnown,
  isKnownPositiveMinor,
  isUnknown,
  type CaseFacts,
  type CaseOutput,
  type FactSnapshot,
  type TriFact,
} from "@app-tour/finance-core/case";

import {
  buildFactCoverageReport,
  type FactCoverageReport,
  type ProviderCoverageName,
} from "./fact-coverage";

export type TriFactFieldDiagnostic = {
  readonly path: string;
  readonly provider: ProviderCoverageName;
  readonly required: boolean;
  readonly kind: "known" | "unknown" | "absent";
  readonly reason?: string;
  readonly valuePreview?: string;
};

export type CompletenessReasonInference = {
  readonly completenessClass: CaseOutput["completenessClass"];
  /** Reasons that force inspect/escalate — mirrors finance-core evaluateCompleteness (observation only). */
  readonly inferredReasons: readonly string[];
  readonly reading: CaseOutput["reading"];
};

export type EncounterFactCoverageDiagnostic = {
  readonly registrationId: string;
  readonly executionId: string;
  readonly reading: CaseOutput["reading"];
  readonly completenessClass: CaseOutput["completenessClass"];
  readonly primaryPosture: CaseOutput["primaryPosture"];
  readonly decisionReady: boolean;
  readonly coverage: FactCoverageReport;
  readonly fields: readonly TriFactFieldDiagnostic[];
  readonly requiredUnknown: readonly TriFactFieldDiagnostic[];
  readonly requiredAbsent: readonly TriFactFieldDiagnostic[];
  readonly optionalGaps: readonly TriFactFieldDiagnostic[];
  readonly degradedProviders: readonly string[];
  readonly completeness: CompletenessReasonInference;
  readonly semanticNote: string;
};

function triKind(fact: TriFact<unknown>): "known" | "unknown" | "absent" {
  if (isKnown(fact)) return "known";
  if (isAbsent(fact)) return "absent";
  return "unknown";
}

function triReason(fact: TriFact<unknown>): string | undefined {
  if (isUnknown(fact) && "reason" in fact && typeof fact.reason === "string") {
    return fact.reason;
  }
  return undefined;
}

function triPreview(fact: TriFact<unknown>): string | undefined {
  if (isKnown(fact)) {
    return JSON.stringify(fact.value);
  }
  return undefined;
}

function field(
  path: string,
  provider: ProviderCoverageName,
  required: boolean,
  fact: TriFact<unknown>
): TriFactFieldDiagnostic {
  return {
    path,
    provider,
    required,
    kind: triKind(fact),
    reason: triReason(fact),
    valuePreview: triPreview(fact),
  };
}

/**
 * Flatten portable CaseFacts into field diagnostics with provider attribution.
 */
export function listCaseFactFieldDiagnostics(facts: CaseFacts): readonly TriFactFieldDiagnostic[] {
  return [
    field("money.obligationPresent", "obligation", true, facts.money.obligationPresent),
    field("money.collectionPolicy", "obligation", true, facts.money.collectionPolicy),
    field("money.amountDue", "obligation", true, facts.money.amountDue),
    field("money.remaining", "obligation", true, facts.money.remaining),
    field("money.currency", "obligation", true, facts.money.currency),
    field("money.scheduleKind", "obligation", true, facts.money.scheduleKind),
    field("money.partialScopeDeclared", "obligation", true, facts.money.partialScopeDeclared),
    field("intent.intentSet", "payment", true, facts.intent.intentSet),
    field("intent.intentKind", "payment", true, facts.intent.intentKind),
    field("intent.intentOpen", "payment", true, facts.intent.intentOpen),
    field("intent.provenanceKnown", "payment", true, facts.intent.provenanceKnown),
    field("intent.duplicateOrParallelSuspected", "payment", true, facts.intent.duplicateOrParallelSuspected),
    field("settlement.settlementMeaning", "payment", true, facts.settlement.settlementMeaning),
    field("evidence.proofExists", "evidence", true, facts.evidence.proofExists),
    field("evidence.proofProgress", "evidence", true, facts.evidence.proofProgress),
    field("evidence.evidenceInspectable", "evidence", true, facts.evidence.evidenceInspectable),
    field("evidence.evidenceSource", "evidence", true, facts.evidence.evidenceSource),
    field(
      "eligibility.lifecycleEligibility",
      "lifecycle",
      true,
      facts.eligibility.lifecycleEligibility
    ),
    field(
      "exceptionCues.closedWithLeftoverArtifacts",
      "lifecycle",
      true,
      facts.exceptionCues.closedWithLeftoverArtifacts
    ),
    field("exceptionCues.meaningConflict", "lifecycle", true, facts.exceptionCues.meaningConflict),
    field("auditCues.ledgerRefsPresent", "ledger", false, facts.auditCues.ledgerRefsPresent),
    field("auditCues.reconFinding", "ledger", false, facts.auditCues.reconFinding),
  ];
}

/**
 * Observation-only mirror of evaluateCompleteness inspect/escalate reason collection.
 * Does not change verdicts — used to explain why live Case is incomplete.
 */
export function inferCompletenessInspectReasons(facts: CaseFacts): readonly string[] {
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
    !proofInReview
  ) {
    reasons.push("partial_scope_unknown");
  }

  if (
    (isKnown(facts.exceptionCues.meaningConflict) &&
      facts.exceptionCues.meaningConflict.value === true) ||
    (isKnown(facts.intent.duplicateOrParallelSuspected) &&
      facts.intent.duplicateOrParallelSuspected.value === true) ||
    (isKnown(facts.exceptionCues.closedWithLeftoverArtifacts) &&
      facts.exceptionCues.closedWithLeftoverArtifacts.value === true)
  ) {
    reasons.push("conflict_cues");
  }

  return reasons;
}

function semanticNoteFor(output: CaseOutput): string {
  if (output.reading === "INCOMPLETE_INSPECT") {
    return (
      "INCOMPLETE_INSPECT means required facts are insufficient for a stronger reading — " +
      "not a provider crash, Case failure, payment failure, or ownership failure."
    );
  }
  return "Reading is decisive enough for presentation; still ephemeral CaseOutput.";
}

/**
 * Build a full coverage diagnostic from an executed Case (snapshot + output).
 */
export function buildEncounterFactCoverageDiagnostic(input: {
  readonly registrationId: string;
  readonly executionId: string;
  readonly snapshot: FactSnapshot;
  readonly caseOutput: CaseOutput;
  readonly degradedProviders?: readonly string[];
}): EncounterFactCoverageDiagnostic {
  const degradedProviders = input.degradedProviders ?? [];
  const coverage = buildFactCoverageReport({
    snapshot: input.snapshot,
    degradedProviders,
  });
  const fields = listCaseFactFieldDiagnostics(input.snapshot.facts);
  const requiredUnknown = fields.filter((f) => f.required && f.kind === "unknown");
  const requiredAbsent = fields.filter((f) => f.required && f.kind === "absent");
  const optionalGaps = fields.filter(
    (f) => !f.required && (f.kind === "unknown" || f.kind === "absent")
  );
  const inferredReasons = inferCompletenessInspectReasons(input.snapshot.facts);

  return {
    registrationId: input.registrationId,
    executionId: input.executionId,
    reading: input.caseOutput.reading,
    completenessClass: input.caseOutput.completenessClass,
    primaryPosture: input.caseOutput.primaryPosture,
    decisionReady: input.caseOutput.decisionReady,
    coverage,
    fields,
    requiredUnknown,
    requiredAbsent,
    optionalGaps,
    degradedProviders,
    completeness: {
      completenessClass: input.caseOutput.completenessClass,
      inferredReasons,
      reading: input.caseOutput.reading,
    },
    semanticNote: semanticNoteFor(input.caseOutput),
  };
}

export type CoverageCauseBucket =
  | "obligation_unread"
  | "eligibility_unknown"
  | "evidence_gap"
  | "payment_gap"
  | "lifecycle_closed_ambiguity"
  | "optional_ledger_signal"
  | "other";

/**
 * Classify top incomplete causes from a diagnostic (report aggregation).
 */
export function classifyIncompleteCause(
  diagnostic: EncounterFactCoverageDiagnostic
): CoverageCauseBucket {
  const reasons = new Set(diagnostic.completeness.inferredReasons);
  if (reasons.has("money_meaning_unknown") || reasons.has("obligation_unknown_with_evidence")) {
    return "obligation_unread";
  }
  if (reasons.has("eligibility_unknown")) {
    return "eligibility_unknown";
  }
  if (reasons.has("evidence_inspectability_unknown")) {
    return "evidence_gap";
  }
  if (reasons.has("closed_artifact_meaning_unknown") || reasons.has("conflict_cues")) {
    return "lifecycle_closed_ambiguity";
  }
  const unknownPaths = diagnostic.requiredUnknown.map((f) => f.path);
  if (unknownPaths.some((p) => p.startsWith("intent.") || p.startsWith("settlement."))) {
    return "payment_gap";
  }
  if (diagnostic.optionalGaps.length > 0 && diagnostic.requiredUnknown.length === 0) {
    return "optional_ledger_signal";
  }
  return "other";
}
