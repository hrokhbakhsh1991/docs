import { randomUUID } from "node:crypto";
import {
  ReconciliationMismatchReason,
  type ReconciliationMismatch
} from "./reconciliation-mismatch";

export type DetectPaymentMismatchInput = {
  tenantId: string;
  bookingId: string;
  /** PSP-settled or provider-reported captured amount (minor units, decimal string). */
  pspAmountMinor: string;
  /** Sum or net ledger fact for the same payment correlation (minor units). */
  ledgerAmountMinor: string;
  /** Immutable booking price snapshot total at sale time (`computed_total_minor`). */
  bookingSnapshotAmountMinor: string;
  /** ISO 4217; all three legs must match this currency. */
  currency: string;
};

function tryParseMinor(raw: string): bigint | undefined {
  const s = raw.trim();
  if (s === "") {
    return undefined;
  }
  try {
    return BigInt(s);
  } catch {
    return undefined;
  }
}

/**
 * Compares **PSP amount**, **ledger amount**, and **booking snapshot amount** (same currency).
 * Returns **`null`** when all three parsed values are equal; otherwise a {@link ReconciliationMismatch}
 * materialized for logging / persistence (foundation only — no repair).
 */
export function detectPaymentMismatch(input: DetectPaymentMismatchInput): ReconciliationMismatch | null {
  const currency = input.currency.trim().toUpperCase();
  if (currency === "") {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      tenantId: input.tenantId.trim(),
      bookingId: input.bookingId.trim(),
      currency: "",
      psp_amount_minor: input.pspAmountMinor.trim(),
      ledger_amount_minor: input.ledgerAmountMinor.trim(),
      booking_snapshot_amount_minor: input.bookingSnapshotAmountMinor.trim(),
      delta_psp_vs_ledger_minor: "0",
      delta_psp_vs_snapshot_minor: "0",
      delta_ledger_vs_snapshot_minor: "0",
      detectedAt: now,
      reason: ReconciliationMismatchReason.CURRENCY_INCONSISTENT
    };
  }

  const psp = tryParseMinor(input.pspAmountMinor);
  const ledger = tryParseMinor(input.ledgerAmountMinor);
  const snap = tryParseMinor(input.bookingSnapshotAmountMinor);

  if (psp === undefined || ledger === undefined || snap === undefined) {
    return buildMismatch(
      input,
      ReconciliationMismatchReason.INVALID_AMOUNT_FORMAT,
      input.pspAmountMinor.trim(),
      input.ledgerAmountMinor.trim(),
      input.bookingSnapshotAmountMinor.trim(),
      "0",
      "0",
      "0"
    );
  }

  if (psp === ledger && ledger === snap) {
    return null;
  }

  const dPspLedger = psp - ledger;
  const dPspSnap = psp - snap;
  const dLedgerSnap = ledger - snap;

  return buildMismatch(
    input,
    ReconciliationMismatchReason.AMOUNT_TRIAD_MISMATCH,
    input.pspAmountMinor.trim(),
    input.ledgerAmountMinor.trim(),
    input.bookingSnapshotAmountMinor.trim(),
    dPspLedger.toString(),
    dPspSnap.toString(),
    dLedgerSnap.toString()
  );
}

function buildMismatch(
  input: DetectPaymentMismatchInput,
  reason: ReconciliationMismatchReason,
  pspStr: string,
  ledgerStr: string,
  snapStr: string,
  dPl: string,
  dPs: string,
  dLs: string
): ReconciliationMismatch {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    tenantId: input.tenantId.trim(),
    bookingId: input.bookingId.trim(),
    currency: input.currency.trim().toUpperCase(),
    psp_amount_minor: pspStr,
    ledger_amount_minor: ledgerStr,
    booking_snapshot_amount_minor: snapStr,
    delta_psp_vs_ledger_minor: dPl,
    delta_psp_vs_snapshot_minor: dPs,
    delta_ledger_vs_snapshot_minor: dLs,
    detectedAt: now,
    reason
  };
}
