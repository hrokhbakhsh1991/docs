/**
 * DP-6 — refund orchestration after cancellation (uses FinanceRefund SoT).
 */
import { computeDenaliRefundEligibility } from "@app-tour/workspace-denali/booking";
import type { BookingPaymentStatus } from "@app-tour/booking-http-contracts";

import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service.ts";
import type { FinanceService } from "../workspace-finance/finance.service.ts";

export type RefundOrchestrationResult = {
  readonly drafted: boolean;
  readonly refundId: string | null;
  readonly refundIds: readonly string[];
  readonly refundStatus:
    | "not_required"
    | "pending_finance_approval"
    | "completed"
    | "manual_review";
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

type RefundSourceAllocation = {
  readonly sourceKind: "payment" | "prepayment";
  readonly paymentId: string | null;
  readonly grossMinor: bigint;
};

type RegistrationRefund = Awaited<ReturnType<FinanceService["listRefundsForRegistration"]>>[number];

const ACTIVE_REFUND_STATUSES = new Set(["Requested", "Approved"]);
const RESERVED_REFUND_STATUSES = new Set(["Requested", "Approved", "Completed"]);

function sumRefundMinor(
  refunds: readonly RegistrationRefund[],
  predicate: (refund: RegistrationRefund) => boolean
): bigint {
  let total = BigInt(0);
  for (const refund of refunds) {
    if (predicate(refund)) {
      total += parseMinor(refund.amountMinor);
    }
  }
  return total;
}

function matchesRefundSource(refund: RegistrationRefund, source: RefundSourceAllocation): boolean {
  return (
    refund.sourceKind === source.sourceKind &&
    (source.sourceKind === "prepayment" || refund.paymentId === source.paymentId)
  );
}

async function resolveRefundSources(
  finance: FinanceService,
  tenantId: string,
  actorUserId: string,
  registrationId: string
): Promise<{
  readonly sources: readonly RefundSourceAllocation[];
  readonly refunds: readonly RegistrationRefund[];
}> {
  const auth = financeActor(tenantId, actorUserId);
  const [payments, invoice, refunds] = await Promise.all([
    finance.listPayments(auth, 500, registrationId),
    finance.getRegistrationInvoice(auth, registrationId),
    finance.listRefundsForRegistration(auth, registrationId),
  ]);
  const paidManual = payments
    .filter((row) => row.status === "Paid" && row.method === "Manual")
    .sort((left, right) => {
      const byCreatedAt = Date.parse(left.createdAt) - Date.parse(right.createdAt);
      return byCreatedAt !== 0 ? byCreatedAt : left.id.localeCompare(right.id);
    });
  const sources: RefundSourceAllocation[] = paidManual.map((payment) => ({
    sourceKind: "payment",
    paymentId: payment.id,
    grossMinor: parseMinor(payment.amount),
  }));

  const collectedGross = parseMinor(invoice.walletNetMinor) + parseMinor(invoice.refundedMinor);
  const manualPaymentGross = paidManual.reduce(
    (total, payment) => total + parseMinor(payment.amount),
    BigInt(0)
  );
  const prepaymentGross = collectedGross - manualPaymentGross;
  if (prepaymentGross > BigInt(0)) {
    sources.push({
      sourceKind: "prepayment",
      paymentId: null,
      grossMinor: prepaymentGross,
    });
  }
  return { sources, refunds };
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
  /**
   * Booking payment is a projection; Finance remains the money SoT. A paid/partial
   * projection with no refundable ledger source is a reconciliation case, not
   * proof that no refund is required.
   */
  readonly projectedPaymentStatus: BookingPaymentStatus;
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
      refundIds: [],
      refundStatus:
        parseMinor(snapshot.refundedCompletedMinor) > BigInt(0)
          ? "completed"
          : input.projectedPaymentStatus === "unpaid"
            ? "not_required"
            : "manual_review",
      amountMinor: "0",
      eligibleRefundMinor: snapshot.eligibleRefundMinor,
      penaltyMinor: snapshot.penaltyMinor,
      replay: false,
    };
  }

  const finance = await resolveFinanceServiceForTenant(input.tenantId);
  const { sources, refunds } = await resolveRefundSources(
    finance,
    input.tenantId,
    input.actorUserId,
    input.registrationId
  );
  if (sources.length === 0) {
    return {
      drafted: false,
      refundId: null,
      refundIds: [],
      refundStatus: "manual_review",
      amountMinor: "0",
      eligibleRefundMinor: snapshot.eligibleRefundMinor,
      penaltyMinor: snapshot.penaltyMinor,
      replay: false,
    };
  }

  const auth = financeActor(input.tenantId, input.actorUserId);
  const eligible = parseMinor(snapshot.eligibleRefundMinor);
  const activeRefunds = refunds.filter((refund) => ACTIVE_REFUND_STATUSES.has(refund.status));
  const activeMinor = sumRefundMinor(activeRefunds, () => true);
  let remaining = eligible > activeMinor ? eligible - activeMinor : BigInt(0);
  let coveredMinor = activeMinor > eligible ? eligible : activeMinor;
  const refundIds = activeRefunds.map((refund) => refund.id);
  let replay = activeRefunds.length > 0;

  for (const source of sources) {
    if (remaining <= BigInt(0)) {
      break;
    }
    const reservedMinor = sumRefundMinor(
      refunds,
      (refund) => RESERVED_REFUND_STATUSES.has(refund.status) && matchesRefundSource(refund, source)
    );
    const headroom = source.grossMinor - reservedMinor;
    if (headroom <= BigInt(0)) {
      continue;
    }
    const amount = remaining < headroom ? remaining : headroom;
    const sourceKey =
      source.sourceKind === "payment" ? (source.paymentId ?? "missing") : "prepayment";
    const refund = await finance.requestRefund(auth, {
      registrationId: input.registrationId,
      sourceKind: source.sourceKind,
      ...(source.paymentId !== null ? { paymentId: source.paymentId } : {}),
      amountMinor: amount.toString(),
      reasonCode: input.reasonCode ?? "member_withdrawal",
      idempotencyKey: `refund:${input.cancelDomainEventId}:${source.sourceKind}:${sourceKey}`,
    });
    if (!refundIds.includes(refund.id)) {
      refundIds.push(refund.id);
    }
    replay = replay || refund.replay === true;
    coveredMinor += amount;
    remaining -= amount;
  }

  if (remaining > BigInt(0)) {
    throw new Error("REFUND_SOURCE_COVERAGE_INCOMPLETE");
  }

  return {
    drafted: refundIds.length > 0,
    refundId: refundIds[0] ?? null,
    refundIds,
    refundStatus: "pending_finance_approval",
    amountMinor: coveredMinor.toString(),
    eligibleRefundMinor: snapshot.eligibleRefundMinor,
    penaltyMinor: snapshot.penaltyMinor,
    replay,
  };
}
