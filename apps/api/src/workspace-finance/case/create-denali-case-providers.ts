/**
 * Compose Denali Case fact providers into finance-core CaseFactAssemblerProviders.
 * Host owns DI; finance-core never sees Denali types or paymentMode.
 */

import type {
  CaseEvidenceFactPort,
  CaseFactAssemblerProviders,
  CasePaymentFactPort,
} from "@app-tour/finance-core/case";

import type { DenaliCaseReadSourcePort } from "../case-read/denali-case-read-source.port";
import { DenaliEvidenceFactProvider } from "../case-read/denali-evidence-fact.provider";
import { DenaliLedgerFactProvider } from "../case-read/denali-ledger-fact.provider";
import { DenaliLifecycleFactProvider } from "../case-read/denali-lifecycle-fact.provider";
import { DenaliObligationFactProvider } from "../case-read/denali-obligation-fact.provider";
import { DenaliPaymentFactProvider } from "../case-read/denali-payment-fact.provider";
import { DenaliSignalFactProvider } from "../case-read/denali-signal-fact.provider";

export type CreateDenaliCaseFactProvidersOptions = {
  /** Include ledger audit cues (default true when source.readLedger present). */
  readonly includeLedger?: boolean;
  /** Include discovery signal provider (default true when source.readSignal present). */
  readonly includeSignal?: boolean;
  /**
   * Host payment capability override (PR10-B / PR10-C).
   * When omitted, defaults to Denali manual/offline payment read path.
   */
  readonly payment?: CasePaymentFactPort;
  /**
   * Host evidence capability override (PR10-C online gateway proof).
   * When omitted, defaults to Denali receipt evidence read path.
   */
  readonly evidence?: CaseEvidenceFactPort;
};

/**
 * Build Case fact providers from an injectable Denali SoT source.
 * Required: obligation, payment, evidence, lifecycle.
 * Optional: ledger, signal, payment/evidence capability overrides.
 */
export function createDenaliCaseFactProviders(
  source: DenaliCaseReadSourcePort,
  options: CreateDenaliCaseFactProvidersOptions = {}
): CaseFactAssemblerProviders {
  const includeLedger = options.includeLedger ?? source.readLedger !== undefined;
  const includeSignal = options.includeSignal ?? source.readSignal !== undefined;
  const payment = options.payment ?? new DenaliPaymentFactProvider(source);
  const evidence = options.evidence ?? new DenaliEvidenceFactProvider(source);

  const providers: CaseFactAssemblerProviders = {
    obligation: new DenaliObligationFactProvider(source),
    payment,
    evidence,
    lifecycle: new DenaliLifecycleFactProvider(source),
  };

  if (includeLedger) {
    return {
      ...providers,
      ledger: new DenaliLedgerFactProvider(source),
      ...(includeSignal ? { signal: new DenaliSignalFactProvider(source) } : {}),
    };
  }

  if (includeSignal) {
    return {
      ...providers,
      signal: new DenaliSignalFactProvider(source),
    };
  }

  return providers;
}
