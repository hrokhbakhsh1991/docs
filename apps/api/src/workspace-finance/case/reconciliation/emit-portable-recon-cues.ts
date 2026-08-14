/**
 * Map Host recon findings → portable observation-only cue kinds (PR11-B).
 */

import type {
  PortableReconCue,
  PortableReconCueKind,
  ReconFindingCode,
} from "./types";

const CONFLICT_CODES: ReadonlySet<ReconFindingCode> = new Set([
  "GW_PAID_SOT_MISSING",
  "AMOUNT_MISMATCH",
  "DUPLICATE_PAYMENT_EVIDENCE",
]);

const UNKNOWN_CODES: ReadonlySet<ReconFindingCode> = new Set([
  "SOT_PAID_GW_UNKNOWN",
  "PROVIDER_DEGRADED",
  "SETTLEMENT_DELAYED",
]);

const ATTENTION_CODES: ReadonlySet<ReconFindingCode> = new Set([
  "GW_PAID_SOT_MISSING",
  "SOT_PAID_GW_UNKNOWN",
  "AMOUNT_MISMATCH",
  "DUPLICATE_PAYMENT_EVIDENCE",
  "SETTLEMENT_DELAYED",
  "PROVIDER_DEGRADED",
]);

function codesOf(
  findings: readonly ReconFindingCode[],
  set: ReadonlySet<ReconFindingCode>
): ReconFindingCode[] {
  return findings.filter((c) => set.has(c));
}

/**
 * Emit portable cues from finding codes.
 * Never invents ownership / failure / refund language.
 */
export function emitPortableReconCues(
  findings: readonly ReconFindingCode[]
): readonly PortableReconCue[] {
  const cues: PortableReconCue[] = [];
  const conflict = codesOf(findings, CONFLICT_CODES);
  const unknown = codesOf(findings, UNKNOWN_CODES);
  const attention = codesOf(findings, ATTENTION_CODES);

  if (conflict.length > 0) {
    cues.push({ kind: "reconciliationConflict", codes: conflict });
  }
  if (unknown.length > 0) {
    cues.push({ kind: "reconciliationUnknown", codes: unknown });
  }
  if (attention.length > 0) {
    cues.push({ kind: "reconciliationAttention", codes: attention });
  }
  return cues;
}

export function hasCueKind(
  cues: readonly PortableReconCue[],
  kind: PortableReconCueKind
): boolean {
  return cues.some((c) => c.kind === kind);
}

export function allFindingCodes(
  cues: readonly PortableReconCue[]
): readonly ReconFindingCode[] {
  const out: ReconFindingCode[] = [];
  for (const cue of cues) {
    for (const code of cue.codes) {
      if (!out.includes(code)) out.push(code);
    }
  }
  return out;
}
