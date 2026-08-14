/**
 * Case payment fact provider — intent + settlement meaning facts only.
 * Not IBookingPaymentPort / createManualPayment / repository payment commands.
 */

import type { IntentFacts, SettlementFacts } from "../facts/fact-groups";
import type { CaseFactProviderResult, CaseFactReadScope } from "./case-fact-read-scope";

export type CasePaymentFactBundle = {
  readonly intent: IntentFacts;
  readonly settlement: SettlementFacts;
};

export interface CasePaymentFactPort {
  readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>>;
}
