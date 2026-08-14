/**
 * Denali receipt / proof SoT → EvidenceFacts.
 * Missing receipt row (ok read) → absent. Read failure → unknown.
 */

import type { DenaliEvidenceSource } from "./denali-case-read-sources";
import { absentFact, knownFact } from "./fact-tokens";
import type { EvidenceFacts, ProofProgress } from "./portable-facts";
import { unknownEvidenceFacts } from "./unknown-fact-groups";

function mapReceiptProgress(status: string): ProofProgress {
  const s = status.toLowerCase();
  if (s === "approved" || s === "accepted") {
    return "accepted";
  }
  if (s === "rejected" || s === "denied") {
    return "rejected";
  }
  if (s === "pending" || s === "submitted" || s === "in_review" || s === "review") {
    return "in_review";
  }
  return "none";
}

export function mapDenaliEvidenceToEvidenceFacts(source: DenaliEvidenceSource): EvidenceFacts {
  if (source.readStatus === "failed") {
    return unknownEvidenceFacts("evidence_read_failed");
  }
  if (source.readStatus === "missing") {
    // Subject missing from SoT — cannot assert absent proof honestly.
    return unknownEvidenceFacts("evidence_sot_missing");
  }

  const receipt = source.receipt;
  if (receipt === null || receipt === undefined) {
    return {
      proofExists: absentFact(),
      proofProgress: knownFact("none"),
      evidenceInspectable: knownFact(false),
      evidenceSource: knownFact("offline"),
    };
  }

  const progress = mapReceiptProgress(receipt.status);
  return {
    proofExists: knownFact(true),
    proofProgress: knownFact(progress),
    evidenceInspectable: knownFact(receipt.fileKey.trim().length > 0),
    evidenceSource: knownFact("offline"),
  };
}
