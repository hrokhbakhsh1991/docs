/**
 * Finance Case Command Bridge HTTP contracts (PR14-B).
 * Intent-only request · presentation-only success · typed public failures.
 */

import { z } from "zod";

import type {
  FinanceCaseEncounterPresentation,
  FinanceCaseEncounterSurfaceState,
} from "./finance-case-encounter.contracts";
import type {
  FinanceCaseCommandActionToken,
  FinanceCaseCommandCapability,
  FinanceCaseCommandDecision,
} from "./finance-case-command-capability.contracts";

export type FinanceCaseCommandReviewReceiptHttpBody = {
  readonly caseKey: string;
  readonly action: {
    readonly command: "reviewReceipt";
    readonly token: FinanceCaseCommandActionToken;
    readonly decision: FinanceCaseCommandDecision;
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

export type FinanceCaseCommandHttpOk = {
  readonly encounter: FinanceCaseEncounterPresentation;
  readonly executionId: string;
  readonly surfaceState: FinanceCaseEncounterSurfaceState;
  readonly meaningFingerprint: string;
  readonly commandCapability: FinanceCaseCommandCapability;
  readonly command: {
    readonly name: "reviewReceipt";
    readonly token: FinanceCaseCommandActionToken;
    readonly decision: FinanceCaseCommandDecision;
  };
};

export type FinanceCaseCommandHttpErrorCode =
  | "CASE_COMMAND_AUTH_DENIED"
  | "CASE_COMMAND_VOCABULARY_DENIED"
  | "CASE_COMMAND_STALE"
  | "CASE_COMMAND_SOT_REJECTED"
  | "CASE_COMMAND_INTENT_INVALID"
  | "CASE_COMMAND_PROVIDER_UNAVAILABLE"
  | "CASE_COMMAND_REEXECUTE_FAILED";

export type FinanceCaseCommandHttpResult =
  | { readonly status: 200; readonly body: FinanceCaseCommandHttpOk }
  | {
      readonly status: 400 | 403 | 409 | 503;
      readonly error: {
        readonly code: FinanceCaseCommandHttpErrorCode;
        readonly message: string;
      };
    };

const reviewReceiptCommandBodySchema = z
  .object({
    caseKey: z.string().min(1),
    action: z.object({
      command: z.literal("reviewReceipt"),
      token: z.enum(["approve_evidence", "reject_evidence"]),
      decision: z.enum(["approve", "reject"]),
    }),
    source: z.object({
      encounterExecutionId: z.string().min(1),
      encounterVersionHint: z.string().min(1).optional(),
    }),
    correlationId: z.string().min(1).optional(),
    reviewReceipt: z.object({
      registrationId: z.string().min(1),
      counterpartyId: z.string().min(1),
      receiptId: z.string().min(1),
      reviewNote: z.string().max(2000).optional(),
    }),
  })
  .strict();

export function parseFinanceCaseCommandReviewReceiptBody(
  raw: unknown
): FinanceCaseCommandReviewReceiptHttpBody {
  const parsed = reviewReceiptCommandBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("CASE_COMMAND_INTENT_INVALID");
  }
  const data = parsed.data;
  const expected = data.action.token === "approve_evidence" ? "approve" : "reject";
  if (data.action.decision !== expected) {
    throw new Error("CASE_COMMAND_INTENT_INVALID");
  }
  return data;
}

export function deriveFinanceCaseCommandCapability(
  allow: readonly string[]
): FinanceCaseCommandCapability {
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
