/**
 * PR14-B — Adapt FinanceService.reviewReceipt to ReviewReceiptCommandPort.
 * Session auth is authoritative; bridge actor must match session.
 */

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import type { FinanceActorContext } from "../../ports/finance-actor-context";
import type { ReviewReceiptCommandPort } from "./run-review-receipt-bridge";

export type FinanceReviewReceiptService = {
  readonly reviewReceipt: (
    auth: TenantAuthContext,
    receiptId: string,
    body: { readonly decision: "approve" | "reject"; readonly reviewNote?: string }
  ) => Promise<Record<string, unknown>>;
};

/**
 * Bind live FinanceService to the bridge SoT port.
 * Denali uses this adapter; future workspaces inject their own port.
 */
export function createFinanceServiceReviewReceiptAdapter(
  finance: FinanceReviewReceiptService,
  session: TenantAuthContext
): ReviewReceiptCommandPort {
  return {
    async reviewReceipt(auth: FinanceActorContext, receiptId, body) {
      if (auth.tenantId !== session.tenantId || auth.userId !== session.userId) {
        throw new Error("CASE_COMMAND_AUTH_DENIED");
      }
      const result = await finance.reviewReceipt(session, receiptId, body);
      const id = typeof result.id === "string" ? result.id : receiptId;
      const status = typeof result.status === "string" ? result.status : "unknown";
      const reviewNote =
        result.reviewNote === null || typeof result.reviewNote === "string"
          ? (result.reviewNote as string | null)
          : null;
      const reviewedAt =
        result.reviewedAt === null || typeof result.reviewedAt === "string"
          ? (result.reviewedAt as string | null)
          : null;
      return { id, status, reviewNote, reviewedAt };
    },
  };
}
