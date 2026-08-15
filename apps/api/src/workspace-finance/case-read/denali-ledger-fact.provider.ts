/**
 * Denali-backed Case ledger fact provider — audit cues only (optional).
 */

import {
  mapDenaliLedgerToAuditCues,
  unknownAuditCues,
  type AuditCueFacts,
  type CaseFactProviderResult,
  type CaseFactReadScope,
} from "../workspace-finance-case-read-bindings.generated";

import type { DenaliCaseReadSourcePort } from "./denali-case-read-source.port";

export class DenaliLedgerFactProvider {
  constructor(private readonly source: Pick<DenaliCaseReadSourcePort, "readLedger">) {}

  async readAuditCues(scope: CaseFactReadScope): Promise<CaseFactProviderResult<AuditCueFacts>> {
    if (this.source.readLedger === undefined) {
      return {
        ok: false,
        degraded: true,
        failureReason: "unsupported",
        value: unknownAuditCues("ledger_unsupported"),
      };
    }
    try {
      const sot = await this.source.readLedger(scope);
      const value = mapDenaliLedgerToAuditCues(sot);
      if (sot.readStatus === "failed") {
        return { ok: false, degraded: true, failureReason: "unavailable", value };
      }
      if (sot.readStatus === "missing") {
        return { ok: false, degraded: true, failureReason: "not_found", value };
      }
      return { ok: true, value };
    } catch {
      const value = mapDenaliLedgerToAuditCues({ readStatus: "failed" });
      return { ok: false, degraded: true, failureReason: "unavailable", value };
    }
  }
}
