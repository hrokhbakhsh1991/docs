/**
 * Host DI selection — payment capability → CasePaymentFactPort (PR10-B).
 * finance-core does not know paymentMode.
 */

import type { CasePaymentFactPort } from "@app-tour/finance-core/case";

import type { PaymentCapabilityMode } from "./types";

export type PaymentCaseFactProviderSet = {
  readonly manual: CasePaymentFactPort;
  readonly online: CasePaymentFactPort;
};

/**
 * Select which payment fact provider feeds the assembler.
 * Switching modes requires only this Host choice + config.
 */
export function selectPaymentCaseFactProvider(input: {
  readonly mode: PaymentCapabilityMode;
  readonly providers: PaymentCaseFactProviderSet;
}): CasePaymentFactPort {
  return input.mode === "online" ? input.providers.online : input.providers.manual;
}
