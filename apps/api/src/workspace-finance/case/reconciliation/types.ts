/**
 * Host reconciliation finding taxonomy (PR11-B).
 * Observation codes only — never Case ownership / repair language.
 */

export type ReconFindingCode =
  | "GW_PAID_SOT_MISSING"
  | "SOT_PAID_GW_UNKNOWN"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_PAYMENT_EVIDENCE"
  | "SETTLEMENT_DELAYED"
  | "PROVIDER_DEGRADED";

/**
 * Portable Host cue kinds — describe observations only.
 * Forbidden meanings: payment failed / refund required / finance owns it.
 */
export type PortableReconCueKind =
  | "reconciliationAttention"
  | "reconciliationConflict"
  | "reconciliationUnknown";

export type PortableReconCue = {
  readonly kind: PortableReconCueKind;
  readonly codes: readonly ReconFindingCode[];
};

export type ReconSourceReadStatus = "ok" | "missing" | "degraded";

/** Host-normalized gateway side of the compare (no vendor enums). */
export type ReconGatewayObservation = {
  readonly read: ReconSourceReadStatus;
  /** Gateway indicates money movement / settled-like observation. */
  readonly paidLike: boolean;
  readonly settlementPendingOrUnknown: boolean;
  readonly amountMinor: string | null;
  readonly evidencePresent: boolean;
};

/** Host-normalized finance SoT side of the compare. */
export type ReconFinanceSotObservation = {
  readonly read: ReconSourceReadStatus;
  readonly paidLike: boolean;
  readonly amountMinor: string | null;
  readonly paymentRowCount: number;
  readonly evidenceCount: number;
};

export type ReconClassifyInput = {
  readonly gateway: ReconGatewayObservation;
  readonly finance: ReconFinanceSotObservation;
};

export type HostReconClassification = {
  readonly findings: readonly ReconFindingCode[];
  readonly cues: readonly PortableReconCue[];
};
