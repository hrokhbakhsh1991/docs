/**
 * Shared command capability metadata for Finance Case encounter/command seams.
 * Neutral contract to avoid encounter <-> command type cycles.
 */

export type FinanceCaseCommandName = "reviewReceipt";

export type FinanceCaseCommandActionToken = "approve_evidence" | "reject_evidence";

export type FinanceCaseCommandDecision = "approve" | "reject";

/** Capability metadata for UI seam — not executable permissions. */
export type FinanceCaseCommandCapability = {
  readonly supportedCommands: readonly ["reviewReceipt"];
  readonly reviewReceipt: {
    readonly availableTokens: readonly FinanceCaseCommandActionToken[];
    readonly endpoint: "/finance/case/commands/review-receipt";
  };
};
