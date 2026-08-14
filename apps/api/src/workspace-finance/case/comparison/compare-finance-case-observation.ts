/**
 * Host Case vs operational comparison engine (PR5-A / PR16-B).
 * Observational only — never mutates CaseOutput or workflows.
 */

import type { CaseOutput } from "@app-tour/finance-core/case";

import type {
  FinanceCaseComparisonCategory,
  ShadowMismatchTaxonomyCode,
} from "./comparison-taxonomy-types";
import type { OperationalObservation } from "./operational-observation";

export type { FinanceCaseComparisonCategory } from "./comparison-taxonomy-types";

export type InterpreterClassification = {
  readonly reading: CaseOutput["reading"];
  readonly owner: CaseOutput["owner"];
  readonly lane: CaseOutput["lane"];
  readonly completenessClass: CaseOutput["completenessClass"];
  readonly decisionReady: boolean;
};

export type FinanceCaseComparisonInput = {
  readonly caseOutput: CaseOutput | null;
  readonly operational: OperationalObservation | null;
  readonly degradedProviders?: readonly string[];
  readonly shadowFailed?: boolean;
};

export type FinanceCaseComparisonResult = {
  readonly category: FinanceCaseComparisonCategory;
  readonly interpreter: InterpreterClassification | null;
  readonly operational: OperationalObservation | null;
  readonly notes: readonly string[];
  /** PR16-B operator taxonomy hints (primary first). */
  readonly taxonomyHints: readonly ShadowMismatchTaxonomyCode[];
};

/** Read-only projection — does not mutate CaseOutput. */
export function projectInterpreterClassification(
  caseOutput: CaseOutput
): InterpreterClassification {
  return {
    reading: caseOutput.reading,
    owner: caseOutput.owner,
    lane: caseOutput.lane,
    completenessClass: caseOutput.completenessClass,
    decisionReady: caseOutput.decisionReady,
  };
}

function expectedOpsOwner(owner: CaseOutput["owner"]): OperationalObservation["followUpOwner"] {
  switch (owner) {
    case "finance":
      return "finance_queue";
    case "counterparty":
      return "counterparty_wait";
    case "idle":
      return "idle";
    case "exception_policy":
      return "exception_bucket";
    case "product_desk":
    case "policy_system":
      return "product_desk";
    case "audit":
      return "unknown";
    default:
      return "unknown";
  }
}

function expectedOpsCategory(
  reading: CaseOutput["reading"]
): OperationalObservation["financeCategory"] | null {
  switch (reading) {
    case "AWAITING_COUNTERPARTY":
    case "INTENT_OPEN_NO_PROOF":
    case "PARTIAL_SCOPED":
      return "awaiting_receipt";
    case "AWAITING_FINANCE":
      return "awaiting_review";
    case "SETTLED_CAPTURED":
    case "CLOSED_IDLE":
      return "settled";
    case "NO_MONEY_DUE":
      return "no_money";
    case "NOT_ELIGIBLE":
      return "ineligible";
    case "EXCEPTION":
      return null;
    case "INCOMPLETE_INSPECT":
      return null;
    default:
      return null;
  }
}

function uncomparable(
  interpreter: InterpreterClassification | null,
  operational: OperationalObservation | null,
  notes: readonly string[],
  taxonomyHints: readonly ShadowMismatchTaxonomyCode[]
): FinanceCaseComparisonResult {
  return {
    category: "uncomparable",
    interpreter,
    operational,
    notes,
    taxonomyHints,
  };
}

function result(
  category: FinanceCaseComparisonCategory,
  interpreter: InterpreterClassification | null,
  operational: OperationalObservation | null,
  notes: readonly string[],
  taxonomyHints: readonly ShadowMismatchTaxonomyCode[]
): FinanceCaseComparisonResult {
  return { category, interpreter, operational, notes, taxonomyHints };
}

/**
 * Compare ephemeral CaseOutput to current operational classification.
 * Pure; never throws for taxonomy misses — returns uncomparable when needed.
 */
export function compareFinanceCaseObservation(
  input: FinanceCaseComparisonInput
): FinanceCaseComparisonResult {
  if (input.shadowFailed === true || input.caseOutput === null) {
    return uncomparable(null, input.operational, ["shadow_failed_or_missing_case_output"], [
      "UNCOMPARABLE",
    ]);
  }

  const interpreter = projectInterpreterClassification(input.caseOutput);
  const notes: string[] = [];

  const degraded = input.degradedProviders ?? [];
  const optionalDegraded = degraded.filter((p) => p === "ledger" || p === "signal");
  const requiredDegraded = degraded.filter((p) => p !== "ledger" && p !== "signal");

  if (
    requiredDegraded.length > 0 ||
    interpreter.reading === "INCOMPLETE_INSPECT" ||
    interpreter.completenessClass === "inspect_forced"
  ) {
    return uncomparable(
      interpreter,
      input.operational,
      ["incomplete_or_degraded_snapshot"],
      ["MISSING_FACT_COVERAGE"]
    );
  }

  if (optionalDegraded.length > 0) {
    notes.push(`optional_provider_degraded:${optionalDegraded.join(",")}`);
  }

  if (input.operational === null) {
    return uncomparable(interpreter, null, ["operational_observation_unavailable"], [
      "UNCOMPARABLE",
    ]);
  }

  const ops = input.operational;

  if (interpreter.reading === "NOT_ELIGIBLE" && ops.collectionAttempted) {
    return result(
      "eligibility_disagreement",
      interpreter,
      ops,
      ["case_not_eligible_but_ops_collecting"],
      ["ELIGIBILITY_MISMATCH"]
    );
  }

  if (ops.collectionAttempted && interpreter.reading === "NOT_ELIGIBLE") {
    return result(
      "eligibility_disagreement",
      interpreter,
      ops,
      ["ops_collecting_case_not_eligible"],
      ["ELIGIBILITY_MISMATCH"]
    );
  }

  const caseException = interpreter.reading === "EXCEPTION" || interpreter.lane === "exception";
  if (caseException !== ops.closedWithPossibleLeftovers) {
    if (caseException || ops.closedWithPossibleLeftovers) {
      return result(
        "exception_disagreement",
        interpreter,
        ops,
        ["exception_cue_mismatch"],
        ["EXCEPTION_MISMATCH"]
      );
    }
  }

  const expectedOwner = expectedOpsOwner(interpreter.owner);
  if (expectedOwner !== "unknown" && ops.followUpOwner !== "unknown") {
    if (expectedOwner !== ops.followUpOwner) {
      notes.push(`owner_case=${interpreter.owner};ops=${ops.followUpOwner}`);
      return result("owner_disagreement", interpreter, ops, notes, ["OWNERSHIP_MISMATCH"]);
    }
  }

  // Completeness: ops settled/idle vs Case escalate posture (ownership lane already matched).
  if (
    (ops.financeCategory === "settled" || ops.followUpOwner === "idle") &&
    (interpreter.completenessClass === "escalate_forced" || interpreter.lane === "exception") &&
    interpreter.reading !== "SETTLED_CAPTURED" &&
    interpreter.reading !== "CLOSED_IDLE" &&
    interpreter.reading !== "EXCEPTION"
  ) {
    notes.push(
      `completeness_case=${interpreter.completenessClass};ops=${ops.financeCategory}`
    );
    return result("reading_disagreement", interpreter, ops, notes, ["COMPLETENESS_MISMATCH"]);
  }

  // Attention / pending-receipt signal vs Case finance wait.
  const caseAwaitingFinance = interpreter.reading === "AWAITING_FINANCE";
  if (ops.pendingReceiptQueue !== caseAwaitingFinance) {
    // Only flag when one side clearly expects finance attention.
    if (ops.pendingReceiptQueue || caseAwaitingFinance) {
      notes.push(
        `signal_pending_queue=${ops.pendingReceiptQueue};case_awaiting_finance=${caseAwaitingFinance}`
      );
      // Prefer reading disagreement when financeCategory also diverges.
      const expectedCategory = expectedOpsCategory(interpreter.reading);
      if (expectedCategory !== null && expectedCategory !== ops.financeCategory) {
        notes.push(`reading_case=${interpreter.reading};ops=${ops.financeCategory}`);
        return result("reading_disagreement", interpreter, ops, notes, [
          "SIGNAL_MISMATCH",
          "VERDICT_MISMATCH",
        ]);
      }
      return result("reading_disagreement", interpreter, ops, notes, ["SIGNAL_MISMATCH"]);
    }
  }

  // Confidence cue: decisionReady vs ops still chasing review/receipt.
  if (
    interpreter.decisionReady === true &&
    (ops.pendingReceiptQueue || ops.financeCategory === "awaiting_review")
  ) {
    notes.push("confidence_decision_ready_vs_ops_pending_review");
    return result("reading_disagreement", interpreter, ops, notes, ["SIGNAL_MISMATCH"]);
  }

  const expectedCategory = expectedOpsCategory(interpreter.reading);
  if (expectedCategory !== null && expectedCategory !== ops.financeCategory) {
    notes.push(`reading_case=${interpreter.reading};ops=${ops.financeCategory}`);
    return result("reading_disagreement", interpreter, ops, notes, ["VERDICT_MISMATCH"]);
  }

  return result("aligned", interpreter, ops, notes, ["ALIGNED"]);
}
