/**
 * Execution request / context / diagnostics — runtime only, never persisted.
 */

import type { CaseFactReadScope } from "../ports/case-fact-read-scope";
import type { ProviderInvocationStatus } from "../assemble/assemble-case-fact-snapshot";
import type { EncounterMode } from "../snapshot/fact-snapshot";

export type CaseExecutionRequest = {
  readonly scope: CaseFactReadScope;
  readonly mode: EncounterMode;
  /** Default true when ledger provider is present. */
  readonly includeLedger?: boolean;
  /** Default true when signal provider is present. */
  readonly includeSignal?: boolean;
  readonly providerTimeoutMs?: number;
  /** Optional caller-supplied id; otherwise generated. */
  readonly executionId?: string;
};

export type CaseExecutionContext = {
  readonly executionId: string;
  readonly caseKey: string;
  readonly mode: EncounterMode;
  readonly startedAtMs: number;
};

export type CaseExecutionDiagnostics = {
  readonly executionId: string;
  readonly caseKey: string;
  readonly mode: EncounterMode;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly totalDurationMs: number;
  readonly assembleDurationMs: number;
  readonly interpreterDurationMs: number;
  readonly providers: {
    readonly obligation: ProviderInvocationStatus;
    readonly payment: ProviderInvocationStatus;
    readonly evidence: ProviderInvocationStatus;
    readonly lifecycle: ProviderInvocationStatus;
    readonly ledger: ProviderInvocationStatus;
    readonly signal: ProviderInvocationStatus;
  };
  readonly degradedProviders: readonly string[];
};
