/**
 * Case Execution Layer (PR3.5) — orchestration only.
 *
 * assemble → interpretFinanceCase → CaseOutput + diagnostics
 * Does not import rules/, ownership, or posture modules.
 */

import { randomUUID } from "node:crypto";

import {
  assembleCaseFactSnapshot,
  type CaseFactAssemblerProviders,
} from "../assemble/assemble-case-fact-snapshot";
import { interpretFinanceCase } from "../interpret/interpret-finance-case";
import type { CaseOutput } from "../output/case-output";
import type { FactSnapshot } from "../snapshot/fact-snapshot";
import type {
  CaseExecutionDiagnostics,
  CaseExecutionRequest,
} from "./execution-types";

export type ExecuteFinanceCaseResult = {
  readonly caseOutput: CaseOutput;
  readonly snapshot: FactSnapshot;
  readonly diagnostics: CaseExecutionDiagnostics;
};

function degradedProviderNames(
  providers: CaseExecutionDiagnostics["providers"]
): readonly string[] {
  const names: string[] = [];
  for (const key of [
    "obligation",
    "payment",
    "evidence",
    "lifecycle",
    "ledger",
    "signal",
  ] as const) {
    const status = providers[key];
    if (status.invoked && status.degraded) {
      names.push(key);
    }
  }
  return names;
}

/**
 * Run providers → snapshot → pure interpreter.
 * Never mutates CaseOutput after interpret; never repairs facts.
 */
export async function executeFinanceCase(
  providers: CaseFactAssemblerProviders,
  request: CaseExecutionRequest
): Promise<ExecuteFinanceCaseResult> {
  const executionId = request.executionId ?? randomUUID();
  const startedAtMs = Date.now();

  const assembleStarted = Date.now();
  const assembled = await assembleCaseFactSnapshot(providers, {
    scope: request.scope,
    mode: request.mode,
    includeLedger: request.includeLedger,
    includeSignal: request.includeSignal,
    providerTimeoutMs: request.providerTimeoutMs,
  });
  const assembleDurationMs = Date.now() - assembleStarted;

  const interpretStarted = Date.now();
  const caseOutput = interpretFinanceCase(assembled.snapshot);
  const interpreterDurationMs = Date.now() - interpretStarted;

  const completedAtMs = Date.now();
  const providersStatus = assembled.providers;
  const diagnostics: CaseExecutionDiagnostics = {
    executionId,
    caseKey: request.scope.caseKey,
    mode: request.mode,
    startedAtMs,
    completedAtMs,
    totalDurationMs: completedAtMs - startedAtMs,
    assembleDurationMs,
    interpreterDurationMs,
    providers: providersStatus,
    degradedProviders: degradedProviderNames(providersStatus),
  };

  return {
    caseOutput,
    snapshot: assembled.snapshot,
    diagnostics,
  };
}
