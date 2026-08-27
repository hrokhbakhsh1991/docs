import { createClientSafeUuid } from "@app-tour/draft-engine";

/**
 * PR18-B — reviewReceipt Command Bridge client helpers (intent + typed results).
 * Does not call FinanceService; does not import finance-core Case internals.
 */

export type FinanceCaseCommandActionToken = "approve_evidence" | "reject_evidence";

export type FinanceCaseCommandReviewReceiptBody = {
  readonly caseKey: string;
  readonly action: {
    readonly command: "reviewReceipt";
    readonly token: FinanceCaseCommandActionToken;
    readonly decision: "approve" | "reject";
  };
  readonly source: {
    readonly encounterExecutionId: string;
    readonly encounterVersionHint?: string;
  };
  readonly correlationId?: string;
  readonly reviewReceipt: {
    readonly registrationId: string;
    readonly counterpartyId: string;
    readonly receiptId: string;
    readonly reviewNote?: string;
  };
};

export type FinanceCaseCommandFailureClass =
  | "auth_denied"
  | "vocabulary_denied"
  | "concurrency_conflict"
  | "sot_rejected"
  | "provider_unavailable"
  | "reexecute_failed"
  | "intent_invalid"
  | "unknown";

export type FinanceCaseCommandClientResult =
  | {
      readonly ok: true;
      readonly executionId: string;
      readonly meaningFingerprint?: string;
    }
  | {
      readonly ok: false;
      readonly failureClass: FinanceCaseCommandFailureClass;
      readonly code: string;
      readonly message: string;
      readonly forceRefresh: boolean;
    };

export type FinanceCaseCommandUiPhase =
  | "idle"
  | "select"
  | "confirm"
  | "submitting"
  | "success"
  | "failure";

const TOKEN_TO_DECISION: Record<FinanceCaseCommandActionToken, "approve" | "reject"> = {
  approve_evidence: "approve",
  reject_evidence: "reject",
};

export function decisionForCommandToken(
  token: FinanceCaseCommandActionToken
): "approve" | "reject" {
  return TOKEN_TO_DECISION[token];
}

/** Confirmation is mandatory before POST — select alone is not enough. */
export function requiresCommandConfirmation(phase: FinanceCaseCommandUiPhase): boolean {
  return phase === "confirm" || phase === "submitting";
}

export function canSubmitCommandFromPhase(phase: FinanceCaseCommandUiPhase): boolean {
  return phase === "confirm";
}

export function buildReviewReceiptCommandBody(input: {
  readonly caseKey: string;
  readonly executionId: string;
  readonly meaningFingerprint?: string;
  readonly token: FinanceCaseCommandActionToken;
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly receiptId: string;
  readonly reviewNote?: string;
  readonly correlationId?: string;
}): FinanceCaseCommandReviewReceiptBody {
  const decision = decisionForCommandToken(input.token);
  return {
    caseKey: input.caseKey,
    action: {
      command: "reviewReceipt",
      token: input.token,
      decision,
    },
    source: {
      encounterExecutionId: input.executionId,
      ...(input.meaningFingerprint !== undefined && input.meaningFingerprint.length > 0
        ? { encounterVersionHint: input.meaningFingerprint }
        : {}),
    },
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    reviewReceipt: {
      registrationId: input.registrationId,
      counterpartyId: input.counterpartyId,
      receiptId: input.receiptId,
      ...(input.reviewNote !== undefined && input.reviewNote.trim().length > 0
        ? { reviewNote: input.reviewNote.trim() }
        : {}),
    },
  };
}

export function mapCommandHttpCodeToFailureClass(code: string): FinanceCaseCommandFailureClass {
  switch (code) {
    case "CASE_COMMAND_AUTH_DENIED":
      return "auth_denied";
    case "CASE_COMMAND_VOCABULARY_DENIED":
      return "vocabulary_denied";
    case "CASE_COMMAND_STALE":
      return "concurrency_conflict";
    case "CASE_COMMAND_SOT_REJECTED":
      return "sot_rejected";
    case "CASE_COMMAND_PROVIDER_UNAVAILABLE":
      return "provider_unavailable";
    case "CASE_COMMAND_REEXECUTE_FAILED":
      return "reexecute_failed";
    case "CASE_COMMAND_INTENT_INVALID":
      return "intent_invalid";
    default:
      return "unknown";
  }
}

export function failureRequiresMeaningRefresh(failureClass: FinanceCaseCommandFailureClass): boolean {
  return (
    failureClass === "concurrency_conflict" ||
    failureClass === "reexecute_failed" ||
    failureClass === "vocabulary_denied"
  );
}

export function parseFinanceCaseCommandClientResult(
  status: number,
  payload: unknown
): FinanceCaseCommandClientResult {
  if (status === 200 && payload !== null && typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    const executionId =
      typeof row.executionId === "string" && row.executionId.trim().length > 0
        ? row.executionId.trim()
        : null;
    if (executionId !== null) {
      return {
        ok: true,
        executionId,
        ...(typeof row.meaningFingerprint === "string"
          ? { meaningFingerprint: row.meaningFingerprint }
          : {}),
      };
    }
  }

  const error =
    payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>).error
      : undefined;
  const errObj =
    error !== null && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof errObj.code === "string" ? errObj.code : "CASE_COMMAND_UNKNOWN";
  const message =
    typeof errObj.message === "string" && errObj.message.trim().length > 0
      ? errObj.message
      : code;
  const failureClass = mapCommandHttpCodeToFailureClass(code);
  return {
    ok: false,
    failureClass,
    code,
    message,
    forceRefresh: failureRequiresMeaningRefresh(failureClass),
  };
}

export function createCommandIdempotencyKey(): string {
  return createClientSafeUuid();
}

/** Web BFF path — never the Host FinanceService module. */
export const FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH =
  "/api/finance/case/commands/review-receipt" as const;
