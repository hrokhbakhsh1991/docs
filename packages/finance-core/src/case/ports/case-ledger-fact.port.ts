/**
 * Case ledger fact provider — audit cues only.
 * Must never become daily decision authority.
 */

import type { AuditCueFacts } from "../facts/fact-groups";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export interface CaseLedgerFactPort {
  readAuditCues(scope: CaseFactReadScope): Promise<CaseFactProviderResult<AuditCueFacts>>;
}
