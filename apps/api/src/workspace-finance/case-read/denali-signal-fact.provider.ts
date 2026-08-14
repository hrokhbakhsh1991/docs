/**
 * Denali-backed Case signal fact provider — EncounterMetadata attention only.
 */

import {
  mapDenaliSignalToAttention,
  unknownSignalBundle,
  type CaseFactProviderResult,
  type CaseFactReadScope,
  type CaseSignalFactBundle,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliSignalFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readSignal">) {}

  async readAttention(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseSignalFactBundle>> {
    if (this.source.readSignal === undefined) {
      return { ok: true, value: unknownSignalBundle() };
    }
    try {
      const sot = await this.source.readSignal(scope);
      const value = mapDenaliSignalToAttention(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      return { ok: true, value };
    } catch {
      return {
        ok: false,
        degraded: true,
        failureReason: "unavailable",
        value: unknownSignalBundle(),
      };
    }
  }
}
