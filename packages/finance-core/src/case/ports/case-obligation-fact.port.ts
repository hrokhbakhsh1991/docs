/**
 * Case obligation fact provider — money/policy facts only.
 * Not FinanceObligationPort / registration workflow ports.
 */

import type { MoneyFacts } from "../facts/fact-groups";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export interface CaseObligationFactPort {
  readMoneyFacts(scope: CaseFactReadScope): Promise<CaseFactProviderResult<MoneyFacts>>;
}
