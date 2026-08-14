/**
 * Pure Host reconciliation classifier (PR11-B).
 * Compare only — no SoT writes, no Case persistence, no ownership decisions.
 */

import { emitPortableReconCues } from "./emit-portable-recon-cues";
import type {
  HostReconClassification,
  ReconClassifyInput,
  ReconFindingCode,
} from "./types";

function amountsDiffer(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const na = a.trim();
  const nb = b.trim();
  if (na.length === 0 || nb.length === 0) return false;
  return na !== nb;
}

/**
 * Classify gateway vs finance SoT observations into finding codes + portable cues.
 */
export function classifyPaymentReconciliation(
  input: ReconClassifyInput
): HostReconClassification {
  const findings: ReconFindingCode[] = [];
  const { gateway, finance } = input;

  if (gateway.read === "degraded") {
    findings.push("PROVIDER_DEGRADED");
  }

  if (
    gateway.read === "ok" &&
    gateway.paidLike &&
    finance.read === "ok" &&
    !finance.paidLike &&
    finance.paymentRowCount === 0
  ) {
    findings.push("GW_PAID_SOT_MISSING");
  }

  if (
    finance.read === "ok" &&
    finance.paidLike &&
    (gateway.read === "degraded" || gateway.read === "missing")
  ) {
    findings.push("SOT_PAID_GW_UNKNOWN");
  }

  if (
    gateway.read === "ok" &&
    finance.read === "ok" &&
    amountsDiffer(gateway.amountMinor, finance.amountMinor)
  ) {
    findings.push("AMOUNT_MISMATCH");
  }

  if (finance.paymentRowCount > 1 || finance.evidenceCount > 1) {
    findings.push("DUPLICATE_PAYMENT_EVIDENCE");
  } else if (gateway.evidencePresent && finance.evidenceCount >= 1) {
    findings.push("DUPLICATE_PAYMENT_EVIDENCE");
  }

  // Payment path exists but settlement confirmation not yet known/settled.
  if (
    gateway.read === "ok" &&
    gateway.settlementPendingOrUnknown &&
    (finance.paymentRowCount > 0 || gateway.paidLike === false)
  ) {
    // Prefer delayed over inventing a hard conflict when SoT already has rows but not paid.
    if (!findings.includes("GW_PAID_SOT_MISSING")) {
      findings.push("SETTLEMENT_DELAYED");
    }
  }

  const unique = [...new Set(findings)];
  return {
    findings: unique,
    cues: emitPortableReconCues(unique),
  };
}
