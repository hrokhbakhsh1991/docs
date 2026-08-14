/**
 * Denali-backed Case obligation fact provider — translation only.
 * Does not interpret, own money decisions, or write lifecycle/payment.
 */

import {
  mapDenaliObligationToMoneyFacts,
  type CaseFactProviderResult,
  type CaseFactReadScope,
  type MoneyFacts,
} from "@app-tour/workspace-denali/host/finance/case-read";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliObligationFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readObligation">) {}

  async readMoneyFacts(scope: CaseFactReadScope): Promise<CaseFactProviderResult<MoneyFacts>> {
    try {
      const sot = await this.source.readObligation(scope);
      const value = mapDenaliObligationToMoneyFacts(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      if (sot.readStatus === "missing") {
        return { ok: false, degraded: true, failureReason: "not_found", value };
      }
      return { ok: true, value };
    } catch {
      const value = mapDenaliObligationToMoneyFacts({ readStatus: "failed" });
      return { ok: false, degraded: true, failureReason: "unavailable", value };
    }
  }
}
