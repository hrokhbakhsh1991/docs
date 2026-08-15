/**
 * Host SoT loader for Denali Case fact providers.
 * Composition root injects Prisma/RLS implementations later — this PR keeps I/O injectable.
 * Opaque string ids only on the wire into mappers.
 */

import type {
  CaseFactReadScope,
  DenaliEvidenceSource,
  DenaliLedgerSource,
  DenaliLifecycleSource,
  DenaliObligationSource,
  DenaliPaymentSource,
  DenaliSignalSource,
} from "../workspace-finance-case-read-bindings.generated";

export type DenaliCaseReadSourcePort = {
  readObligation(scope: CaseFactReadScope): Promise<DenaliObligationSource>;
  readPayment(scope: CaseFactReadScope): Promise<DenaliPaymentSource>;
  readEvidence(scope: CaseFactReadScope): Promise<DenaliEvidenceSource>;
  readLifecycle(scope: CaseFactReadScope): Promise<DenaliLifecycleSource>;
  readLedger?(scope: CaseFactReadScope): Promise<DenaliLedgerSource>;
  readSignal?(scope: CaseFactReadScope): Promise<DenaliSignalSource>;
};
