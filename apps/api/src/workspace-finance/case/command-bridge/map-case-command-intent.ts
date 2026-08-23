/**
 * PR14-A — Map CaseCommandIntent → reviewReceipt bridge intent + SoT port shape.
 * Workspace capability injects the SoT implementation.
 */

import type { CaseCommandIntent } from "./case-command-intent";
import { CaseCommandIntentInvalidError, mapReviewReceiptIntent } from "./map-review-receipt";
import type { MappedReviewReceiptCommand } from "./map-review-receipt";
import type { ReviewReceiptBridgeIntent } from "./types";

/**
 * Portable SoT port — each workspace binds its own command implementation.
 * finance-core never implements this.
 */
export type ReviewReceiptSoTPort = {
  readonly reviewReceipt: (
    auth: ReviewReceiptBridgeIntent["auth"],
    receiptId: string,
    body: { readonly decision: "approve" | "reject"; readonly reviewNote?: string }
  ) => Promise<{
    readonly id: string;
    readonly status: string;
    readonly reviewNote: string | null;
    readonly reviewedAt: string | null;
  }>;
};

/**
 * Convert architecture intent → Host pilot bridge intent.
 */
export function toReviewReceiptBridgeIntent(intent: CaseCommandIntent): ReviewReceiptBridgeIntent {
  if (intent.action.command !== "reviewReceipt") {
    throw new CaseCommandIntentInvalidError("unsupported_command");
  }
  if (intent.workspace.tenantId !== intent.actor.tenantId) {
    throw new CaseCommandIntentInvalidError("workspace_actor_tenant_mismatch");
  }
  return {
    tenantId: intent.workspace.tenantId,
    caseKey: intent.caseKey,
    registrationId: intent.reviewReceipt.registrationId,
    counterpartyId: intent.reviewReceipt.counterpartyId,
    receiptId: intent.reviewReceipt.receiptId,
    actionToken: intent.action.token,
    decision: intent.action.decision,
    ...(intent.reviewReceipt.reviewNote !== undefined
      ? { reviewNote: intent.reviewReceipt.reviewNote }
      : {}),
    correlationId: intent.correlationId,
    auth: intent.actor,
    sourceEncounterExecutionId: intent.source.encounterExecutionId,
    ...(intent.source.encounterVersionHint !== undefined
      ? { sourceEncounterVersionHint: intent.source.encounterVersionHint }
      : {}),
  };
}

/**
 * Validate CaseCommandIntent and produce SoT args (no mutation).
 */
export function mapCaseCommandIntent(intent: CaseCommandIntent): MappedReviewReceiptCommand {
  return mapReviewReceiptIntent(toReviewReceiptBridgeIntent(intent));
}
