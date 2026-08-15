/**
 * Denali-backed Case evidence fact provider — proof facts only.
 */

import {
  mapDenaliEvidenceToEvidenceFacts,
  type CaseFactProviderResult,
  type CaseFactReadScope,
  type EvidenceFacts,
} from "../workspace-finance-case-read-bindings.generated";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliEvidenceFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readEvidence">) {}

  async readEvidenceFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<EvidenceFacts>> {
    try {
      const sot = await this.source.readEvidence(scope);
      const value = mapDenaliEvidenceToEvidenceFacts(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      if (sot.readStatus === "missing") {
        return { ok: false, degraded: true, failureReason: "not_found", value };
      }
      return { ok: true, value };
    } catch {
      const value = mapDenaliEvidenceToEvidenceFacts({ readStatus: "failed" });
      return { ok: false, degraded: true, failureReason: "unavailable", value };
    }
  }
}
