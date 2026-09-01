/**
 * DP-6 — refund orchestration after cancellation (uses FinanceRefund SoT).
 */
import { computeDenaliRefundEligibility } from "../workspace/denali-host-legacy-bindings.generated.ts";

import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service.ts";
import type { FinanceService } from "../workspace-finance/finance.service.ts";

export type RefundOrchestrationResult = {
  readonly drafted: boolean;
  readonly refundId: string | null;
  readonly amountMinor: string;
  readonly eligibleRefundMinor: string;
  readonly penaltyMinor: string;
  readonly replay: boolean;
};

export type RefundEligibilitySnapshot = {
  readonly collectedMinor: string;
  readonly refundedCompletedMinor: string;
  readonly financeCapMinor: string;
  readonly penaltyMinor: string;
  readonly eligibleRefundMinor: string;
  readonly currency: string;
  readonly hasOpenRefundRequest: boolean;
};

function financeActor(tenantId: string, userId: string) {
  return {
    tenantId,
    userId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
}

function parseMinor(value: string): bigint {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 ? BigInt(0) : BigInt(digits);
}

async function resolveRefundSource(
  finance: FinanceService,
  tenantId: string,
  actorUserId: string,
  registrationId: string
): Promise<
  | { readonly sourceKind: "payment"; readonly paymentId: string }
  | { readonly sourceKind: "prepayment"; readonly paymentId: null }
  | null
> {
  const auth = financeActor(tenantId, actorUserId);
  const payments = await finance.listPayments(auth, 100, registrationId);
  const paidManual = payments.find(
    (row) => row.status === "Paid" && row.method === "Manual"
  );
  if (paidManual !== undefined) {
    return { sourceKind: "payment", paymentId: paidManual.id };
  }

  const invoice = await finance.getRegistrationInvoice(auth, registrationId);
  const collected =
    parseMinor(invoice.walletNetMinor) + parseMinor(invoice.refundedMinor);
  if (collected > BigInt(0)) {
    return { sourceKind: "prepayment", paymentId: null };
  }
  return null;
}

export async function buildRefundEligibilitySnapshot(input: {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly registrationId: string;
  readonly applyPenalty: boolean;
  readonly cancellationPenaltyPercentage?: number | null;
}): Promise<RefundEligibilitySnapshot> {
  const finance = await resolveFinanceServiceForTenant(input.tenantId);
  const auth = financeActor(input.tenantId, input.actorUserId);
  const invoice = await finance.getRegistrationInvoice(auth, input.registrationId);
  const collectedMinor = (
    parseMinor(invoice.walletNetMinor) + parseMinor(invoice.refundedMinor)
  ).toString();
  const refundedCompletedMinor = invoice.refundedMinor;

  const policy = computeDenaliRefundEligibility({
    collectedMinor,
    refundedCompletedMinor,
    cancellationPenaltyPercentage: input.cancellationPenaltyPercentage ?? null,
    applyPenalty: input.applyPenalty,
  });

  const [requested, approved] = await Promise.all([
    finance.listOperatorRefunds(auth, {
      registrationId: input.registrationId,
      status: "Requested",
      limit: 1,
    }),
    finance.listOperatorRefunds(auth, {
      registrationId: input.registrationId,
      status: "Approved",
      limit: 1,
    }),
  ]);

  return {
    collectedMinor,
    refundedCompletedMinor,
    financeCapMinor: policy.financeCapMinor,
    penaltyMinor: policy.penaltyMinor,
    eligibleRefundMinor: policy.eligibleRefundMinor,
    currency: invoice.currency,
    hasOpenRefundRequest: requested.items.length > 0 || approved.items.length > 0,
  };
}

export async function orchestrateRefundAfterCancellation(input: {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly registrationId: string;
  readonly cancelDomainEventId: string;
  readonly applyPenalty: boolean;
  readonly cancellationPenaltyPercentage?: number | null;
  readonly reasonCode?: "member_withdrawal" | "ops_correction";
}): Promise<RefundOrchestrationResult> {
  const snapshot = await buildRefundEligibilitySnapshot({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    registrationId: input.registrationId,
    applyPenalty: input.applyPenalty,
    cancellationPenaltyPercentage: input.cancellationPenaltyPercentage,
  });

  if (parseMinor(snapshot.eligibleRefundMinor) <= BigInt(0)) {
    return {
      drafted: false,
      refundId: null,
      amountMinor: "0",
      eligibleRefundMinor: snapshot.eligibleRefundMinor,
      penaltyMinor: snapshot.penaltyMinor,
      replay: false,
    };
  }

  const finance = await resolveFinanceServiceForTenant(input.tenantId);
  const source = await resolveRefundSource(
    finance,
    input.tenantId,
    input.actorUserId,
    input.registrationId
  );
  if (source === null) {
    return {
      drafted: false,
      refundId: null,
      amountMinor: "0",
      eligibleRefundMinor: snapshot.eligibleRefundMinor,
      penaltyMinor: snapshot.penaltyMinor,
      replay: false,
    };
  }

  const auth = financeActor(input.tenantId, input.actorUserId);
  const refund = await finance.requestRefund(auth, {
    registrationId: input.registrationId,
    sourceKind: source.sourceKind,
    ...(source.paymentId !== null ? { paymentId: source.paymentId } : {}),
    amountMinor: snapshot.eligibleRefundMinor,
    reasonCode: input.reasonCode ?? "member_withdrawal",
    idempotencyKey: `refund:registration.cancel:${input.tenantId}:${input.registrationId}`,
  });

  return {
    drafted: true,
    refundId: refund.id,
    amountMinor: refund.amountMinor,
    eligibleRefundMinor: snapshot.eligibleRefundMinor,
    penaltyMinor: snapshot.penaltyMinor,
    replay: refund.replay === true,
  };
}
