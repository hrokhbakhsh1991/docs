/**
 * Ephemeral CaseOutput — interpretation only, never a persisted status.
 */

import type { CaseSubjectKind } from "../facts/fact-groups";

export type CaseReading =
  | "AWAITING_COUNTERPARTY"
  | "AWAITING_FINANCE"
  | "NO_MONEY_DUE"
  | "NOT_ELIGIBLE"
  | "INTENT_OPEN_NO_PROOF"
  | "PARTIAL_SCOPED"
  | "SETTLED_CAPTURED"
  | "CLOSED_IDLE"
  | "EXCEPTION"
  | "INCOMPLETE_INSPECT";

export type CaseOwner =
  | "finance"
  | "counterparty"
  | "product_desk"
  | "policy_system"
  | "exception_policy"
  | "audit"
  | "idle";

export type CaseLane = "daily" | "exception" | "audit";

export type CasePosture = "act" | "wait" | "inspect" | "escalate";

export type CaseAllowAction =
  | "wait"
  | "inspect"
  | "inspect_evidence"
  | "approve_evidence"
  | "reject_evidence"
  | "escalate"
  | "investigate"
  | "handoff_product"
  | "leave"
  | "exit_audit_to_case";

export type CaseForbidAction =
  | "create_payment_repair"
  | "duplicate_intent"
  | "lifecycle_mutation"
  | "ledger_first_decide"
  | "rechase_counterparty"
  | "chase_receipts"
  | "unscoped_collect"
  | "happy_path_approve";

export type CompletenessClass =
  | "act_complete"
  | "wait_complete"
  | "inspect_forced"
  | "escalate_forced";

export type ConfidenceQuartet = {
  readonly whyVisible: string;
  readonly whyMineOrNot: string;
  readonly ifIWait: string;
  readonly avoid: string;
};

export type CaseOutput = {
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  readonly caseKey: string;
  readonly reading: CaseReading;
  readonly interpretationSentence: string;
  /** True when AWAITING_FINANCE facts suffice to approve/reject (posture flag, not a status). */
  readonly decisionReady: boolean;
  readonly owner: CaseOwner;
  readonly whyOwner: string;
  readonly lane: CaseLane;
  readonly primaryPosture: CasePosture;
  readonly allow: readonly CaseAllowAction[];
  readonly forbid: readonly CaseForbidAction[];
  readonly confidence: ConfidenceQuartet;
  readonly completenessClass: CompletenessClass;
  readonly auditAltitude: boolean;
};

/** Default forbid set — create-payment repair is never a default allow. */
export const DEFAULT_CASE_FORBIDS: readonly CaseForbidAction[] = [
  "create_payment_repair",
  "duplicate_intent",
  "lifecycle_mutation",
  "ledger_first_decide",
] as const;
