/**
 * Manual payment capability adapter (PR10-B).
 * Maps existing Denali receipt/payment SoTs → portable CasePaymentFactPort.
 */

import type {
  CaseFactProviderResult,
  CaseFactReadScope,
  CasePaymentFactBundle,
  CasePaymentFactPort,
} from "@app-tour/finance-core/case";

import { DenaliPaymentFactProvider } from "../../case-read/denali-payment-fact.provider";
import type { DenaliCaseReadSourcePort } from "../../case-read/denali-case-read-source.port";

/**
 * Explicit manual capability boundary over the existing Denali payment read path.
 * Preserves unknown/absent semantics from Denali mappers (unknown ≠ zero).
 */
export class ManualPaymentCaseFactProvider implements CasePaymentFactPort {
  private readonly inner: DenaliPaymentFactProvider;

  constructor(source: Pick<DenaliCaseReadSourcePort, "readPayment">) {
    this.inner = new DenaliPaymentFactProvider(source);
  }

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    const result = await this.inner.readPaymentFacts(scope);
    // Structural portable bundle — no gateway metadata.
    return result as CaseFactProviderResult<CasePaymentFactBundle>;
  }
}
