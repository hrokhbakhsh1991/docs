/**
 * Wire reviewReceipt bridge with live enrollment Case loaders (PR9-B).
 */

import type { CaseCommandAuthorizer } from "./authorize-case-command";
import {
  loadEnrollmentCaseEncounter,
  type LoadEnrollmentCaseEncounterInput,
} from "./load-enrollment-encounter";
import {
  runReviewReceiptCommandBridge,
  type ReviewReceiptCommandPort,
} from "./run-review-receipt-bridge";
import type { ReviewReceiptBridgeIntent, ReviewReceiptBridgeResult } from "./types";

export type CreateReviewReceiptBridgeInput = {
  readonly authorization: CaseCommandAuthorizer;
  readonly finance: ReviewReceiptCommandPort;
  readonly readDeps: LoadEnrollmentCaseEncounterInput["readDeps"];
};

/**
 * Factory: Host production path — loadEncounter always hits live SoT reads.
 */
export function createReviewReceiptCommandBridge(input: CreateReviewReceiptBridgeInput) {
  return {
    async run(intent: ReviewReceiptBridgeIntent): Promise<ReviewReceiptBridgeResult> {
      return runReviewReceiptCommandBridge(intent, {
        authorization: input.authorization,
        finance: input.finance,
        loadEncounter: async (phase) =>
          loadEnrollmentCaseEncounter({
            tenantId: intent.tenantId,
            registrationId: intent.registrationId,
            counterpartyId: intent.counterpartyId,
            readDeps: input.readDeps,
            // Preflight reuses source execution id for correlational continuity;
            // stale protection prefers meaning fingerprint (version hint) when set.
            executionId:
              phase === "preflight"
                ? intent.sourceEncounterExecutionId
                : `${intent.correlationId}:post`,
          }),
      });
    },
  };
}
