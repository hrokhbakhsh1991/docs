/**
 * Host Command Bridge — reviewReceipt (PR9-B pilot + PR14-A production architecture).
 *
 * Authz → fresh Encounter → stale check → vocabulary → existing SoT → re-execute.
 * Case never writes SoTs; failures create no Case state.
 */

import type { FinanceActorContext } from "../../ports/finance-actor-context";
import {
  authorizeCaseCommand,
  CaseCommandAuthzDeniedError,
  type CaseCommandAuthorizer,
} from "./authorize-case-command";
import { CaseCommandIntentInvalidError, mapReviewReceiptIntent } from "./map-review-receipt";
import {
  assertIntentNotStale,
  CaseCommandConcurrencyConflictError,
} from "./stale-intent-guard";
import type {
  CaseEncounterLoadResult,
  ReviewReceiptBridgeFailureReason,
  ReviewReceiptBridgeIntent,
  ReviewReceiptBridgeResult,
} from "./types";
import {
  assertReviewReceiptVocabulary,
  CaseCommandVocabularyRejectedError,
} from "./vocabulary-gate";

export type ReviewReceiptCommandPort = {
  readonly reviewReceipt: (
    auth: FinanceActorContext,
    receiptId: string,
    body: { readonly decision: "approve" | "reject"; readonly reviewNote?: string }
  ) => Promise<{
    readonly id: string;
    readonly status: string;
    readonly reviewNote: string | null;
    readonly reviewedAt: string | null;
  }>;
};

export type RunReviewReceiptCommandBridgeDeps = {
  readonly authorization: CaseCommandAuthorizer;
  readonly finance: ReviewReceiptCommandPort;
  /** Injected for tests; production uses loadEnrollmentCaseEncounter. */
  readonly loadEncounter: (phase: "preflight" | "post") => Promise<CaseEncounterLoadResult>;
};

function fail(
  intent: ReviewReceiptBridgeIntent,
  reason: ReviewReceiptBridgeFailureReason,
  message: string,
  preflight: CaseEncounterLoadResult | null,
  post: CaseEncounterLoadResult | null
): ReviewReceiptBridgeResult {
  return {
    ok: false,
    correlationId: intent.correlationId,
    reason,
    message,
    encounter: post?.encounter ?? preflight?.encounter ?? null,
    preflight,
    post,
  };
}

/**
 * Run the reviewReceipt bridge once.
 * Never patches CaseOutput; never persists Case status.
 */
export async function runReviewReceiptCommandBridge(
  intent: ReviewReceiptBridgeIntent,
  deps: RunReviewReceiptCommandBridgeDeps
): Promise<ReviewReceiptBridgeResult> {
  let mapped;
  try {
    mapped = mapReviewReceiptIntent(intent);
  } catch (err) {
    const message = err instanceof CaseCommandIntentInvalidError ? err.message : "intent_invalid";
    return fail(intent, "intent_invalid", message, null, null);
  }

  try {
    authorizeCaseCommand(deps.authorization, intent.auth);
  } catch (err) {
    const message = err instanceof CaseCommandAuthzDeniedError ? err.message : "auth_denied";
    return fail(intent, "auth_denied", message, null, null);
  }

  let preflight: CaseEncounterLoadResult;
  try {
    preflight = await deps.loadEncounter("preflight");
  } catch (err) {
    const message = err instanceof Error ? err.message : "provider_unavailable";
    return fail(intent, "provider_unavailable", message, null, null);
  }

  try {
    assertIntentNotStale({
      caseKey: intent.caseKey,
      source: {
        encounterExecutionId: intent.sourceEncounterExecutionId,
        ...(intent.sourceEncounterVersionHint !== undefined
          ? { encounterVersionHint: intent.sourceEncounterVersionHint }
          : {}),
      },
      fresh: preflight,
    });
  } catch (err) {
    const message =
      err instanceof CaseCommandConcurrencyConflictError
        ? err.message
        : "concurrency_conflict";
    return fail(intent, "concurrency_conflict", message, preflight, null);
  }

  try {
    assertReviewReceiptVocabulary(preflight.caseOutput, intent.actionToken);
  } catch (err) {
    const message =
      err instanceof CaseCommandVocabularyRejectedError ? err.message : "vocabulary_denied";
    return fail(intent, "vocabulary_denied", message, preflight, null);
  }

  let sotRaw: Awaited<ReturnType<ReviewReceiptCommandPort["reviewReceipt"]>>;
  try {
    sotRaw = await deps.finance.reviewReceipt(intent.auth, mapped.receiptId, mapped.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "sot_rejected";
    let post: CaseEncounterLoadResult | null = null;
    try {
      post = await deps.loadEncounter("post");
    } catch {
      post = null;
    }
    return fail(intent, "sot_rejected", message, preflight, post);
  }

  let post: CaseEncounterLoadResult;
  try {
    post = await deps.loadEncounter("post");
  } catch (err) {
    const message = err instanceof Error ? err.message : "reexecute_failed";
    return fail(intent, "reexecute_failed", message, preflight, null);
  }

  return {
    ok: true,
    correlationId: intent.correlationId,
    sot: {
      receiptId: sotRaw.id,
      decision: intent.decision,
      status: sotRaw.status,
      reviewNote: sotRaw.reviewNote,
      reviewedAt: sotRaw.reviewedAt,
    },
    preflight,
    post,
    audit: {
      actionToken: intent.actionToken,
      caseKey: intent.caseKey,
      receiptId: intent.receiptId,
      actorUserId: intent.auth.userId,
      tenantId: intent.tenantId,
    },
  };
}
