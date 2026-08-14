/**
 * Host Command Bridge intent + result contracts (PR9-B + PR14-A).
 * Pilot / production first command: reviewReceipt only.
 */

import type { CaseOutput, CaseEncounterView } from "@app-tour/finance-core/case";
import type { FinanceActorContext } from "../../ports/finance-actor-context";
import type {
  ReviewReceiptActionToken,
  ReviewReceiptDecision,
} from "./case-command-intent";
import type { CaseCommandBridgeFailureCode } from "./command-bridge-failures";

export type { ReviewReceiptActionToken, ReviewReceiptDecision };

/**
 * Operator / automation intent — Host-owned.
 * Does not mutate meaning; hints must match decision.
 * `sourceEncounterExecutionId` enables PR14-A stale protection.
 */
export type ReviewReceiptBridgeIntent = {
  readonly tenantId: string;
  readonly caseKey: string;
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly receiptId: string;
  readonly actionToken: ReviewReceiptActionToken;
  readonly decision: ReviewReceiptDecision;
  readonly reviewNote?: string;
  readonly correlationId: string;
  readonly auth: FinanceActorContext;
  /** Provenance from the Encounter the operator acted on (PR14-A). */
  readonly sourceEncounterExecutionId: string;
  readonly sourceEncounterVersionHint?: string;
};

export type CaseEncounterLoadResult = {
  readonly caseOutput: CaseOutput;
  readonly encounter: CaseEncounterView;
  readonly executionId: string;
  /**
   * PR15-H — observation-only provider status for Host telemetry.
   * Never serialized on Encounter HTTP OK body.
   */
  readonly providerObservation?: {
    readonly degradedProviders: readonly string[];
    readonly providers: Readonly<
      Record<
        string,
        {
          readonly invoked: boolean;
          readonly ok: boolean;
          readonly degraded: boolean;
          readonly failureReason?: string;
        }
      >
    >;
  };
};

export type ReviewReceiptSotResult = {
  readonly receiptId: string;
  readonly decision: ReviewReceiptDecision;
  readonly status: string;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
};

/** PR14-A failure taxonomy (includes legacy-compatible codes). */
export type ReviewReceiptBridgeFailureReason = CaseCommandBridgeFailureCode;

export type ReviewReceiptBridgeOk = {
  readonly ok: true;
  readonly correlationId: string;
  readonly sot: ReviewReceiptSotResult;
  readonly preflight: CaseEncounterLoadResult;
  readonly post: CaseEncounterLoadResult;
  readonly audit: {
    readonly actionToken: ReviewReceiptActionToken;
    readonly caseKey: string;
    readonly receiptId: string;
    readonly actorUserId: string;
    readonly tenantId: string;
  };
};

export type ReviewReceiptBridgeErr = {
  readonly ok: false;
  readonly correlationId: string;
  readonly reason: ReviewReceiptBridgeFailureReason;
  readonly message: string;
  /** Present when a preflight or post encounter was loaded; never a Case status row. */
  readonly encounter: CaseEncounterView | null;
  readonly preflight: CaseEncounterLoadResult | null;
  readonly post: CaseEncounterLoadResult | null;
};

export type ReviewReceiptBridgeResult = ReviewReceiptBridgeOk | ReviewReceiptBridgeErr;
