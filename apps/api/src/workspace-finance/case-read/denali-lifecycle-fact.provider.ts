/**
 * Denali-backed Case lifecycle fact provider — eligibility + leftover cues only.
 */

import {
  mapDenaliLifecycleToLifecycleFacts,
  type CaseFactProviderResult,
  type CaseFactReadScope,
  type CaseLifecycleFactBundle,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliLifecycleFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readLifecycle">) {}

  async readLifecycleFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseLifecycleFactBundle>> {
    try {
      const sot = await this.source.readLifecycle(scope);
      const value = mapDenaliLifecycleToLifecycleFacts(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      if (sot.readStatus === "missing") {
        return { ok: false, degraded: true, failureReason: "not_found", value };
      }
      return { ok: true, value };
    } catch {
      const value = mapDenaliLifecycleToLifecycleFacts({ readStatus: "failed" });
      return { ok: false, degraded: true, failureReason: "unavailable", value };
    }
  }
}
