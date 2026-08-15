/**
 * Denali-backed Case payment fact provider — intent + settlement facts only.
 */

import {
  mapDenaliPaymentToPaymentFacts,
  type CaseFactProviderResult,
  type CaseFactReadScope,
  type CasePaymentFactBundle,
} from "../workspace-finance-case-read-bindings.generated";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliPaymentFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readPayment">) {}

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    try {
      const sot = await this.source.readPayment(scope);
      const value = mapDenaliPaymentToPaymentFacts(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      if (sot.readStatus === "missing") {
        return { ok: false, degraded: true, failureReason: "not_found", value };
      }
      return { ok: true, value };
    } catch {
      const value = mapDenaliPaymentToPaymentFacts({ readStatus: "failed" });
      return { ok: false, degraded: true, failureReason: "unavailable", value };
    }
  }
}
