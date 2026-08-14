/**
 * Build Host recon observations from gateway + Denali SoT DTOs (PR11-B).
 */

import type {
  DenaliEvidenceSource,
  DenaliPaymentSource,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type {
  GatewayPaymentRecord,
  GatewayReadResult,
} from "../payment-capability/gateway/payment-gateway.port";
import type { ReconFinanceSotObservation, ReconGatewayObservation } from "./types";

function gatewayPaidLike(record: GatewayPaymentRecord): boolean {
  return record.settlement === "settled";
}

function gatewaySettlementPendingOrUnknown(record: GatewayPaymentRecord): boolean {
  return record.settlement === "pending" || record.settlement === "unknown";
}

export function buildGatewayObservation(
  result: GatewayReadResult | null
): ReconGatewayObservation {
  if (result === null) {
    return {
      read: "missing",
      paidLike: false,
      settlementPendingOrUnknown: false,
      amountMinor: null,
      evidencePresent: false,
    };
  }
  if (!result.ok) {
    return {
      read: "degraded",
      paidLike: false,
      settlementPendingOrUnknown: false,
      amountMinor: null,
      evidencePresent: false,
    };
  }
  if (result.record === null) {
    return {
      read: "missing",
      paidLike: false,
      settlementPendingOrUnknown: false,
      amountMinor: null,
      evidencePresent: false,
    };
  }
  const record = result.record;
  return {
    read: "ok",
    paidLike: gatewayPaidLike(record),
    settlementPendingOrUnknown: gatewaySettlementPendingOrUnknown(record),
    amountMinor: record.amountMinor ?? null,
    evidencePresent: record.evidence !== "none" && record.evidence !== "unknown",
  };
}

function financePaidLike(source: DenaliPaymentSource): boolean {
  const status = (source.bookingPaymentStatus ?? "").toLowerCase();
  if (status === "paid") return true;
  const payments = source.payments ?? [];
  return payments.some((p) => {
    const s = p.status.toLowerCase();
    return s === "paid" || s === "captured" || s === "succeeded" || s === "settled";
  });
}

function financeAmountMinor(source: DenaliPaymentSource): string | null {
  const payments = source.payments ?? [];
  if (payments.length === 0) return null;
  return payments[0]!.amountMinor ?? null;
}

export function buildFinanceSotObservation(input: {
  readonly payment: DenaliPaymentSource;
  readonly evidence: DenaliEvidenceSource;
}): ReconFinanceSotObservation {
  const { payment, evidence } = input;
  if (payment.readStatus === "failed") {
    return {
      read: "degraded",
      paidLike: false,
      amountMinor: null,
      paymentRowCount: 0,
      evidenceCount: 0,
    };
  }
  if (payment.readStatus === "missing") {
    return {
      read: "missing",
      paidLike: false,
      amountMinor: null,
      paymentRowCount: 0,
      evidenceCount: 0,
    };
  }
  const payments = payment.payments ?? [];
  const evidenceCount =
    evidence.readStatus === "ok" && evidence.receipt != null ? 1 : 0;
  return {
    read: "ok",
    paidLike: financePaidLike(payment),
    amountMinor: financeAmountMinor(payment),
    paymentRowCount: payments.length,
    evidenceCount,
  };
}
