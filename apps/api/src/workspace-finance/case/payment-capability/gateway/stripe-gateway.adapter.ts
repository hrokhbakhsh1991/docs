/**
 * Example Host Stripe gateway adapter (PR10-C).
 *
 * Maps Host-normalized Stripe-like ledger rows → PaymentGatewayPort.
 * Vendor SDK / webhook event names stay in Host HTTP + this adapter only.
 * finance-core never imports this file.
 */

import type {
  GatewayEvidenceState,
  GatewayPaymentLifecycle,
  GatewayPaymentRecord,
  GatewayReadResult,
  GatewaySettlementState,
  PaymentGatewayPort,
} from "./payment-gateway.port";

/**
 * Host-owned Stripe-shaped row — NOT a Stripe SDK type.
 * Real deployments replace `StripeLikePaymentLedger` with SDK/DB reads.
 */
export type StripeLikePaymentRow = {
  readonly enrollmentId: string;
  readonly paymentIntentId: string;
  readonly status:
    | "requires_payment_method"
    | "requires_action"
    | "processing"
    | "succeeded"
    | "canceled"
    | "unknown";
  readonly amountMinor?: string;
  readonly chargeCaptured?: boolean;
  readonly refunded?: boolean;
  readonly disputed?: boolean;
  readonly receiptUrl?: string | null;
  readonly chargebackCode?: string;
  /** Passthrough unknown vendor keys for observation. */
  readonly rawExtra?: Readonly<Record<string, unknown>>;
};

export type StripeLikePaymentLedger = {
  findByEnrollmentId(enrollmentId: string): Promise<StripeLikePaymentRow | null>;
};

function mapLifecycle(status: StripeLikePaymentRow["status"]): GatewayPaymentLifecycle {
  switch (status) {
    case "requires_payment_method":
    case "requires_action":
      return "intent_requires_action";
    case "processing":
      return "intent_processing";
    case "succeeded":
      return "intent_succeeded";
    case "canceled":
      return "intent_canceled";
    case "unknown":
      return "intent_unknown";
    default:
      return "intent_unknown";
  }
}

function mapSettlement(row: StripeLikePaymentRow): GatewaySettlementState {
  if (row.disputed === true) return "disputed";
  if (row.refunded === true) return "refunded";
  if (row.chargeCaptured === true) return "settled";
  // Intent succeeded without capture/settlement signal → unknown, not unpaid.
  if (row.status === "succeeded" && row.chargeCaptured === undefined) return "unknown";
  if (row.status === "processing" || row.status === "requires_action" || row.status === "requires_payment_method") {
    return "pending";
  }
  if (row.status === "canceled") return "none";
  if (row.status === "unknown") return "unknown";
  return "none";
}

function mapEvidence(row: StripeLikePaymentRow): GatewayEvidenceState {
  if (row.receiptUrl === undefined) return "none";
  if (row.receiptUrl === null || row.receiptUrl === "") return "none";
  return "present";
}

function unsupportedFromRaw(rawExtra: Readonly<Record<string, unknown>> | undefined): string[] {
  if (rawExtra === undefined) return [];
  return Object.keys(rawExtra);
}

/**
 * Workspace Stripe gateway adapter — Host composition only.
 */
export class StripeGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly ledger: StripeLikePaymentLedger) {}

  async readPaymentBySubject(input: {
    readonly subjectId: string;
    readonly subjectKind: string;
  }): Promise<GatewayReadResult> {
    const started = Date.now();
    try {
      const row = await this.ledger.findByEnrollmentId(input.subjectId);
      const latencyMs = Date.now() - started;
      if (row === null) {
        return { ok: true, record: null, latencyMs };
      }
      const unsupported = [
        ...unsupportedFromRaw(row.rawExtra),
        ...(row.chargebackCode !== undefined ? ["chargebackCode"] : []),
      ];
      const record: GatewayPaymentRecord = {
        subjectId: input.subjectId,
        subjectKind: input.subjectKind,
        externalPaymentRef: row.paymentIntentId,
        lifecycle: mapLifecycle(row.status),
        settlement: mapSettlement(row),
        evidence: mapEvidence(row),
        evidenceInspectable: row.receiptUrl != null && row.receiptUrl !== "",
        amountMinor: row.amountMinor,
        unsupportedFields: unsupported.length > 0 ? unsupported : undefined,
      };
      return { ok: true, record, latencyMs };
    } catch {
      return { ok: false, reason: "unavailable", latencyMs: Date.now() - started };
    }
  }
}
