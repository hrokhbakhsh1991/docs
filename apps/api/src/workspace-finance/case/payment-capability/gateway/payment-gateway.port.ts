/**
 * Host-owned payment gateway read boundary (PR10-C).
 *
 * finance-core must never import this module.
 * Provider brand names, webhook event names, and capture APIs stay outside Case.
 */

/**
 * Portable Host lifecycle labels — not Stripe/PayPal enums.
 * Host adapters map vendor statuses → these labels before Case translation.
 */
export type GatewayPaymentLifecycle =
  | "intent_none"
  | "intent_requires_action"
  | "intent_processing"
  | "intent_succeeded"
  | "intent_canceled"
  | "intent_unknown";

/**
 * Settlement as observed at the gateway/SoT boundary.
 * Missing settlement must remain distinguishable from "unpaid"/"unsettled".
 */
export type GatewaySettlementState =
  | "none"
  | "pending"
  | "settled"
  | "refunded"
  | "disputed"
  | "unknown";

export type GatewayEvidenceState =
  | "none"
  | "present"
  | "in_review"
  | "accepted"
  | "rejected"
  | "unknown";

/**
 * Host gateway ledger row. Opaque refs stay Host-side; Case adapters must strip them.
 */
export type GatewayPaymentRecord = {
  readonly subjectId: string;
  readonly subjectKind: string;
  /** Opaque external payment id — never enter CaseFacts / CaseOutput. */
  readonly externalPaymentRef: string;
  readonly lifecycle: GatewayPaymentLifecycle;
  readonly settlement: GatewaySettlementState;
  readonly evidence: GatewayEvidenceState;
  readonly evidenceInspectable?: boolean;
  /** Minor-unit amount when known — Host recon compare only; never Case identity. */
  readonly amountMinor?: string;
  /** Raw vendor fields observed but not mapped — observation only. */
  readonly unsupportedFields?: readonly string[];
};

export type GatewayReadOk = {
  readonly ok: true;
  /** null = successful empty read (no payment for subject). */
  readonly record: GatewayPaymentRecord | null;
  readonly latencyMs?: number;
};

export type GatewayReadFail = {
  readonly ok: false;
  readonly reason: "unavailable" | "timeout" | "unsupported";
  readonly latencyMs?: number;
};

export type GatewayReadResult = GatewayReadOk | GatewayReadFail;

/**
 * Host implements this with StripeGatewayAdapter (or equivalent).
 * Case providers depend only on this port — never on vendor SDKs.
 */
export interface PaymentGatewayPort {
  readPaymentBySubject(input: {
    readonly subjectId: string;
    readonly subjectKind: string;
  }): Promise<GatewayReadResult>;
}
