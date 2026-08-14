/**
 * PR14-B — Host production path for Case Command Bridge reviewReceipt.
 * Authz → preflight → stale → vocabulary → FinanceService → postflight presentation.
 */

import type {
  FinanceCaseCommandHttpResult,
  FinanceCaseCommandReviewReceiptHttpBody,
} from "@app-tour/finance-http-contracts";
import type { FinanceRouteDeps } from "@app-tour/finance-http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveFinanceServiceForTenant } from "../../../boot/lazy-finance-service";
import type { FinanceService } from "../../finance.service";
import { HostFinanceAccessAdapter } from "../../infrastructure/host-finance-access.adapter";
import type { FinanceActorContext } from "../../ports/finance-actor-context";
import { resolveDenaliCaseCapabilityFromEnv } from "../compose-denali-case-providers";
import { buildLiveDenaliCaseReadDepsForTenant } from "../encounter/build-live-denali-case-read-deps";
import type { CaseCommandIntent } from "./case-command-intent";
import {
  getCaseCommandTelemetrySink,
  safeEmitCaseCommandTelemetry,
  type CaseCommandTelemetryEventName,
  type CaseCommandTelemetrySink,
} from "./command-bridge-telemetry";
import { createFinanceServiceReviewReceiptAdapter } from "./finance-service-review-receipt-adapter";
import { loadEnrollmentCaseEncounter } from "./load-enrollment-encounter";
import { mapBridgeResultToHttp } from "./map-bridge-result-to-http";
import { toReviewReceiptBridgeIntent } from "./map-case-command-intent";
import { runReviewReceiptCommandBridge } from "./run-review-receipt-bridge";
import type { CaseCommandAuthorizer } from "./authorize-case-command";
import type { ReviewReceiptBridgeResult } from "./types";

export type RunFinanceCaseCommandReviewReceiptHttpInput = {
  readonly auth: TenantAuthContext;
  readonly body: FinanceCaseCommandReviewReceiptHttpBody;
  readonly deps: FinanceRouteDeps;
  readonly idempotencyKey?: string;
  readonly requestHash?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly telemetry?: CaseCommandTelemetrySink;
  readonly now?: () => number;
  readonly authorization?: CaseCommandAuthorizer;
  /** Test seam — inject bridge runner outcome. */
  readonly runBridge?: (
    intent: CaseCommandIntent
  ) => Promise<ReviewReceiptBridgeResult>;
};

function actorFromSession(auth: TenantAuthContext): FinanceActorContext {
  return {
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    status: auth.status,
    ...(auth.workspaceId !== undefined ? { workspaceId: auth.workspaceId } : {}),
  };
}

function toCaseCommandIntent(
  auth: TenantAuthContext,
  body: FinanceCaseCommandReviewReceiptHttpBody
): CaseCommandIntent {
  const actor = actorFromSession(auth);
  return {
    caseKey: body.caseKey,
    actor,
    action: {
      command: "reviewReceipt",
      token: body.action.token,
      decision: body.action.decision,
    },
    workspace: {
      workspaceId: auth.workspaceId ?? auth.tenantId,
      tenantId: auth.tenantId,
    },
    source: {
      encounterExecutionId: body.source.encounterExecutionId,
      ...(body.source.encounterVersionHint !== undefined
        ? { encounterVersionHint: body.source.encounterVersionHint }
        : {}),
    },
    correlationId: body.correlationId ?? `case-cmd-${auth.tenantId}-${Date.now()}`,
    reviewReceipt: {
      registrationId: body.reviewReceipt.registrationId,
      counterpartyId: body.reviewReceipt.counterpartyId,
      receiptId: body.reviewReceipt.receiptId,
      ...(body.reviewReceipt.reviewNote !== undefined
        ? { reviewNote: body.reviewReceipt.reviewNote }
        : {}),
    },
  };
}

function telemetryEventName(
  result: ReviewReceiptBridgeResult
): CaseCommandTelemetryEventName {
  if (result.ok) return "succeeded";
  switch (result.reason) {
    case "auth_denied":
      return "auth_denied";
    case "vocabulary_denied":
      return "vocabulary_denied";
    case "concurrency_conflict":
      return "stale_rejected";
    case "sot_rejected":
      return "sot_rejected";
    case "provider_unavailable":
      return "provider_unavailable";
    case "reexecute_failed":
      return "reexecute_failed";
    case "intent_invalid":
      return "intent_invalid";
    default:
      return "sot_rejected";
  }
}

/**
 * Host port implementation for finance-http Case command bridge.
 */
export async function runFinanceCaseCommandReviewReceiptHttp(
  input: RunFinanceCaseCommandReviewReceiptHttpInput
): Promise<FinanceCaseCommandHttpResult> {
  const now = input.now ?? Date.now;
  const telemetry = input.telemetry ?? getCaseCommandTelemetrySink();
  const intent = toCaseCommandIntent(input.auth, input.body);
  const bridgeIntent = toReviewReceiptBridgeIntent(intent);

  const emit = (event: CaseCommandTelemetryEventName, durationMs?: number) => {
    safeEmitCaseCommandTelemetry(telemetry, {
      kind: "case_command",
      event,
      tenantId: input.auth.tenantId,
      caseKey: intent.caseKey,
      command: "reviewReceipt",
      actionToken: intent.action.token,
      correlationId: intent.correlationId,
      registrationId: intent.reviewReceipt.registrationId,
      recordedAtMs: now(),
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
  };

  const startedAtMs = now();
  emit("command_requested");

  const authorization = input.authorization ?? new HostFinanceAccessAdapter();

  let result: ReviewReceiptBridgeResult;
  if (input.runBridge) {
    result = await input.runBridge(intent);
  } else {
    const financeService = await resolveFinanceServiceForTenant(
      input.auth.tenantId,
      input.deps.financeService as FinanceService | undefined
    );
    const financePort = createFinanceServiceReviewReceiptAdapter(financeService, input.auth);
    const readDeps = await buildLiveDenaliCaseReadDepsForTenant(input.auth.tenantId);
    const env = input.env ?? process.env;
    const capability = resolveDenaliCaseCapabilityFromEnv(env);

    const executeBridge = () =>
      runReviewReceiptCommandBridge(bridgeIntent, {
        authorization,
        finance: financePort,
        loadEncounter: async (phase) =>
          loadEnrollmentCaseEncounter({
            tenantId: input.auth.tenantId,
            registrationId: intent.reviewReceipt.registrationId,
            counterpartyId: intent.reviewReceipt.counterpartyId,
            readDeps,
            capability,
            env,
            executionId:
              phase === "preflight"
                ? intent.source.encounterExecutionId
                : `${intent.correlationId}:post`,
          }),
      });

    // Idempotency-Key is required by finance-http for approve; FinanceService.reviewReceipt
    // owns receipt-level approve replay safety. Bridge does not invent Case idempotency rows.
    void input.idempotencyKey;
    void input.requestHash;
    result = await executeBridge();
  }

  emit(telemetryEventName(result), Math.max(0, now() - startedAtMs));
  return mapBridgeResultToHttp(input.body, result);
}
