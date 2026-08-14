/**
 * PR14-B — Command capability metadata for Encounter UI seam.
 * Presentation / availability only — no buttons, no SoT calls.
 */

export type CaseCommandActionTokenContract = "approve_evidence" | "reject_evidence";

export type CaseCommandCapabilityContract = {
  readonly supportedCommands: readonly ["reviewReceipt"];
  readonly reviewReceipt: {
    readonly availableTokens: readonly CaseCommandActionTokenContract[];
    readonly endpoint: "/finance/case/commands/review-receipt";
  };
};

/** Derive available reviewReceipt tokens from EncounterView.allow. */
export function deriveCaseCommandCapability(
  allow: readonly string[]
): CaseCommandCapabilityContract {
  const availableTokens = (["approve_evidence", "reject_evidence"] as const).filter((t) =>
    allow.includes(t)
  );
  return {
    supportedCommands: ["reviewReceipt"],
    reviewReceipt: {
      availableTokens,
      endpoint: "/finance/case/commands/review-receipt",
    },
  };
}

/** True when Host metadata indicates a reviewReceipt token is currently coherent. */
export function isReviewReceiptActionAvailable(
  capability: CaseCommandCapabilityContract | null | undefined,
  token: CaseCommandActionTokenContract
): boolean {
  if (capability === null || capability === undefined) return false;
  return capability.reviewReceipt.availableTokens.includes(token);
}
