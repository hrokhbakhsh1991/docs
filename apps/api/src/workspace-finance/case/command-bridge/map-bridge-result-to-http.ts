/**
 * PR14-B — Map bridge result → public HTTP presentation / typed failure.
 * Never leaks SoT / Prisma / gateway internals.
 */

import {
  deriveFinanceCaseCommandCapability,
  type FinanceCaseCommandHttpErrorCode,
  type FinanceCaseCommandHttpResult,
  type FinanceCaseCommandReviewReceiptHttpBody,
} from "@app-tour/finance-http-contracts";

import { deriveEncounterSurfaceState } from "../encounter/derive-encounter-surface-state";
import {
  assertPresentationBoundary,
  toCaseEncounterPresentation,
} from "../encounter/to-case-encounter-presentation";
import { caseOutputMeaningFingerprint } from "./stale-intent-guard";
import type { ReviewReceiptBridgeResult } from "./types";

function publicError(
  code: FinanceCaseCommandHttpErrorCode,
  message: string,
  status: 400 | 403 | 409 | 503
): FinanceCaseCommandHttpResult {
  return { status, error: { code, message } };
}

export function mapBridgeResultToHttp(
  body: FinanceCaseCommandReviewReceiptHttpBody,
  result: ReviewReceiptBridgeResult
): FinanceCaseCommandHttpResult {
  if (result.ok) {
    const encounter = toCaseEncounterPresentation(result.post.encounter);
    assertPresentationBoundary(encounter);
    const meaningFingerprint = caseOutputMeaningFingerprint(result.post.caseOutput);
    return {
      status: 200,
      body: {
        encounter,
        executionId: result.post.executionId,
        surfaceState: deriveEncounterSurfaceState(encounter),
        meaningFingerprint,
        commandCapability: deriveFinanceCaseCommandCapability(encounter.allow),
        command: {
          name: "reviewReceipt",
          token: body.action.token,
          decision: body.action.decision,
        },
      },
    };
  }

  switch (result.reason) {
    case "auth_denied":
      return publicError("CASE_COMMAND_AUTH_DENIED", "Operator access required", 403);
    case "vocabulary_denied":
      return publicError(
        "CASE_COMMAND_VOCABULARY_DENIED",
        "Current Case meaning does not allow this action",
        409
      );
    case "concurrency_conflict":
      return publicError(
        "CASE_COMMAND_STALE",
        "Encounter changed — reload and retry",
        409
      );
    case "sot_rejected":
      return publicError(
        "CASE_COMMAND_SOT_REJECTED",
        "Finance service rejected this review",
        409
      );
    case "intent_invalid":
      return publicError("CASE_COMMAND_INTENT_INVALID", "Invalid command intent", 400);
    case "provider_unavailable":
      return publicError(
        "CASE_COMMAND_PROVIDER_UNAVAILABLE",
        "Case Encounter temporarily unavailable",
        503
      );
    case "reexecute_failed":
      return publicError(
        "CASE_COMMAND_REEXECUTE_FAILED",
        "Review may have applied — reload Encounter",
        503
      );
    default: {
      const _exhaustive: never = result.reason;
      return _exhaustive;
    }
  }
}
