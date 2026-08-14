/**
 * Map Case action hint → existing FinanceService.reviewReceipt args (PR9-B).
 */

import type { ReviewReceiptBridgeIntent, ReviewReceiptDecision } from "./types";

export class CaseCommandIntentInvalidError extends Error {
  readonly code = "CASE_COMMAND_INTENT_INVALID" as const;
  constructor(readonly detail: string) {
    super(`CASE_COMMAND_INTENT_INVALID:${detail}`);
    this.name = "CaseCommandIntentInvalidError";
  }
}

export type MappedReviewReceiptCommand = {
  readonly receiptId: string;
  readonly body: {
    readonly decision: ReviewReceiptDecision;
    readonly reviewNote?: string;
  };
};

function expectedDecision(token: ReviewReceiptBridgeIntent["actionToken"]): ReviewReceiptDecision {
  return token === "approve_evidence" ? "approve" : "reject";
}

/**
 * Validate intent coherence and produce SoT command args.
 * Does not call FinanceService.
 */
export function mapReviewReceiptIntent(
  intent: ReviewReceiptBridgeIntent
): MappedReviewReceiptCommand {
  if (intent.auth.tenantId !== intent.tenantId) {
    throw new CaseCommandIntentInvalidError("tenant_mismatch");
  }
  if (intent.receiptId.trim().length === 0) {
    throw new CaseCommandIntentInvalidError("receipt_id_required");
  }
  if (intent.registrationId.trim().length === 0) {
    throw new CaseCommandIntentInvalidError("registration_id_required");
  }
  if (intent.caseKey.trim().length === 0) {
    throw new CaseCommandIntentInvalidError("case_key_required");
  }
  const expected = expectedDecision(intent.actionToken);
  if (intent.decision !== expected) {
    throw new CaseCommandIntentInvalidError(
      `decision_token_mismatch:token=${intent.actionToken};decision=${intent.decision}`
    );
  }
  return {
    receiptId: intent.receiptId,
    body: {
      decision: intent.decision,
      ...(intent.reviewNote !== undefined ? { reviewNote: intent.reviewNote } : {}),
    },
  };
}
