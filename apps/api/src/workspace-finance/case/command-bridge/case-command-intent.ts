/**
 * PR14-A — Host CaseCommandIntent architecture contract.
 * Intent is operator choice + provenance — not permission.
 * finance-core never sees or owns this type.
 */

import type { FinanceActorContext } from "../../ports/finance-actor-context";

/** First supported bridge command only. */
export type CaseCommandName = "reviewReceipt";

export type ReviewReceiptActionToken = "approve_evidence" | "reject_evidence";

export type ReviewReceiptDecision = "approve" | "reject";

/**
 * Supported Case-hinted action payload for reviewReceipt.
 * Maps to existing SoT — never invents Case mutation.
 */
export type CaseCommandReviewReceiptAction = {
  readonly command: "reviewReceipt";
  readonly token: ReviewReceiptActionToken;
  readonly decision: ReviewReceiptDecision;
};

export type CaseCommandWorkspaceContext = {
  readonly workspaceId: string;
  readonly tenantId: string;
};

/**
 * Provenance for stale protection — source Encounter must still match
 * before any SoT mutation.
 */
export type CaseCommandSourceEncounter = {
  readonly encounterExecutionId: string;
  /** Optional host version / etag hint; not Case status. */
  readonly encounterVersionHint?: string;
};

export type CaseCommandReviewReceiptPayload = {
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly receiptId: string;
  readonly reviewNote?: string;
};

/**
 * Host-owned operator intent for the Command Bridge.
 * Does not authorize. Does not mutate. Does not persist Case state.
 */
export type CaseCommandIntent = {
  readonly caseKey: string;
  readonly actor: FinanceActorContext;
  readonly action: CaseCommandReviewReceiptAction;
  readonly workspace: CaseCommandWorkspaceContext;
  readonly source: CaseCommandSourceEncounter;
  readonly correlationId: string;
  readonly reviewReceipt: CaseCommandReviewReceiptPayload;
};

/** Explicit non-supported mutation classes (architecture lock). */
export const FORBIDDEN_CASE_COMMAND_MUTATIONS = [
  "payment_capture",
  "refund",
  "settlement",
  "lifecycle_transition",
  "ownership_change",
  "bulk_operations",
  "automatic_actions",
] as const;

export type ForbiddenCaseCommandMutation = (typeof FORBIDDEN_CASE_COMMAND_MUTATIONS)[number];
