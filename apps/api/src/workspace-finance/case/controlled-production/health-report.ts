/**
 * PR19 — Vendor-neutral controlled production health report.
 * Composes Meaning + command + operator + safety + interpretation quality.
 * Never mutates flags; never blocks FinanceService; never expands vocabulary.
 */

import type { CaseCommandTelemetryEvent } from "../command-bridge/command-bridge-telemetry";
import {
  buildCommercialMeaningInternalHealthReport,
  type BuildCommercialMeaningInternalHealthReportInput,
  type CommercialMeaningInternalHealthReport,
} from "../encounter/commercial-meaning-rollout-health";
import {
  summarizeControlledProductionCommands,
  type CommandUiClientEvent,
  type ControlledProductionCommandSummary,
} from "./command-observation-summary";
import {
  summarizeDiscrepancyClasses,
  type ControlledProductionDiscrepancySample,
} from "./discrepancy-class";
import {
  recommendControlledProduction,
  type ControlledProductionRecommendation,
} from "./recommendation";
import {
  evaluateControlledProductionRolloutSafety,
  type ControlledProductionRolloutSafety,
  type ControlledProductionRolloutSafetyInput,
} from "./rollout-safety";

export type ControlledProductionEvidenceClass = "LIVE" | "AUTOMATED" | "FIXTURE";

export type ControlledProductionOperatorBehavior = {
  readonly returnedToOperational: number;
  readonly returnedToOperationalRate: number | null;
  readonly commandAttemptRate: number | null;
  readonly commandSuccessRate: number | null;
  readonly staleFrequency: number;
  readonly retryCount: number;
  readonly classicReviewUsage: number;
};

export type ControlledProductionInterpretationQuality = {
  readonly verdictDistribution: Readonly<Record<string, number>>;
  readonly completenessDistribution: Readonly<Record<string, number>>;
  readonly exceptionRate: number | null;
  readonly incompleteRate: number | null;
  readonly decisionReadyRate: number | null;
  readonly providerDegradation: Readonly<Record<string, number>>;
  readonly unresolvedNoRuleMatched: number;
  readonly discrepancyClassCounts: Readonly<Record<string, number>>;
};

export type ControlledProductionHealthReport = {
  readonly tenantId: string;
  readonly observationWindow: {
    readonly startedAtMs: number;
    readonly endedAtMs: number;
    readonly requestCount: number;
    readonly evidenceClasses: readonly ControlledProductionEvidenceClass[];
  };
  readonly meaning: CommercialMeaningInternalHealthReport;
  readonly command: ControlledProductionCommandSummary;
  readonly operator: ControlledProductionOperatorBehavior;
  readonly safety: ControlledProductionRolloutSafety;
  readonly interpretation: ControlledProductionInterpretationQuality;
  readonly riskIndicators: readonly string[];
  readonly recommendation: ControlledProductionRecommendation;
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
};

export type BuildControlledProductionHealthReportInput =
  BuildCommercialMeaningInternalHealthReportInput & {
    readonly tenantId: string;
    readonly startedAtMs: number;
    readonly endedAtMs?: number;
    readonly safety: ControlledProductionRolloutSafetyInput;
    readonly hostCommandEvents?: readonly CaseCommandTelemetryEvent[];
    readonly commandUiEvents?: readonly CommandUiClientEvent[];
    readonly discrepancySamples?: readonly ControlledProductionDiscrepancySample[];
    readonly decisionReadyCount?: number;
    readonly meaningSampleCountForDecisionReady?: number;
    readonly evidenceClasses?: readonly ControlledProductionEvidenceClass[];
  };

function incompleteRateFromCompleteness(
  completeness: Readonly<Record<string, number>>
): number | null {
  const values = Object.values(completeness);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let incomplete = 0;
  for (const [k, n] of Object.entries(completeness)) {
    if (/incomplete/i.test(k)) incomplete += n;
  }
  return incomplete / total;
}

/**
 * Compose controlled production health dashboard (report-only).
 */
export function buildControlledProductionHealthReport(
  input: BuildControlledProductionHealthReportInput
): ControlledProductionHealthReport {
  const now = input.now ?? Date.now;
  const endedAtMs = input.endedAtMs ?? now();
  const meaning = buildCommercialMeaningInternalHealthReport(input);
  const safety = evaluateControlledProductionRolloutSafety(input.safety);
  const command = summarizeControlledProductionCommands({
    hostEvents: input.hostCommandEvents,
    uiEvents: input.commandUiEvents,
    meaningOpened: meaning.clientFeedback.opened,
  });

  const discrepancySamples = input.discrepancySamples ?? [];
  const discrepancyClassCounts = summarizeDiscrepancyClasses(discrepancySamples);
  const unresolvedNoRuleMatched = discrepancySamples.filter(
    (s) => s.unresolvedNoRuleMatched === true
  ).length;

  const decisionReadyDenom =
    input.meaningSampleCountForDecisionReady ?? meaning.encounter.meaningSummary.sampleCount;
  const decisionReadyRate =
    decisionReadyDenom === 0 || input.decisionReadyCount === undefined
      ? null
      : input.decisionReadyCount / decisionReadyDenom;

  const incompleteRate = incompleteRateFromCompleteness(meaning.completenessDistribution);

  const operator: ControlledProductionOperatorBehavior = {
    returnedToOperational: meaning.clientFeedback.returnedToOperational,
    returnedToOperationalRate: meaning.clientFeedback.returnedToOperationalRate,
    commandAttemptRate: command.attemptRate,
    commandSuccessRate: command.successRate,
    staleFrequency: command.concurrencyConflict,
    retryCount: command.retries,
    classicReviewUsage: command.classicReviewSubmitted,
  };

  const interpretation: ControlledProductionInterpretationQuality = {
    verdictDistribution: meaning.verdictDistribution,
    completenessDistribution: meaning.completenessDistribution,
    exceptionRate: meaning.exceptionFrequency.rate,
    incompleteRate,
    decisionReadyRate,
    providerDegradation: meaning.degradedProviderFrequency,
    unresolvedNoRuleMatched,
    discrepancyClassCounts,
  };

  const riskIndicators: string[] = [];
  if (!safety.ok) riskIndicators.push("safety_not_ok");
  if ((meaning.clientFeedback.timeoutRate ?? 0) >= 0.1) riskIndicators.push("meaning_timeout_pressure");
  if ((command.staleRate ?? 0) >= 0.2) riskIndicators.push("stale_pressure");
  if ((command.authDeniedRate ?? 0) >= 0.1) riskIndicators.push("auth_denied_pressure");
  if ((meaning.exceptionFrequency.rate ?? 0) >= 0.2) riskIndicators.push("exception_pressure");
  if (discrepancyClassCounts.CASE_INTERPRETER > 0) {
    riskIndicators.push("case_interpreter_discrepancy");
  }
  if (unresolvedNoRuleMatched > 0) riskIndicators.push("unresolved_no_rule_matched");
  if (!safety.shadowOff) riskIndicators.push("shadow_unexpectedly_on");

  const recommendation = recommendControlledProduction({
    safetyOk: safety.ok,
    requestCount: meaning.requestCount,
    commandSubmitted: command.submitted,
    commandSuccessRate: command.successRate,
    staleRate: command.staleRate,
    authDeniedRate: command.authDeniedRate,
    meaningAvailability: meaning.availability,
    meaningTimeoutRate: meaning.clientFeedback.timeoutRate,
    exceptionRate: meaning.exceptionFrequency.rate,
    incompleteRate,
    caseInterpreterDiscrepancyCount: discrepancyClassCounts.CASE_INTERPRETER,
    now,
  });

  return {
    tenantId: input.tenantId,
    observationWindow: {
      startedAtMs: input.startedAtMs,
      endedAtMs,
      requestCount: meaning.requestCount,
      evidenceClasses: input.evidenceClasses ?? ["AUTOMATED"],
    },
    meaning,
    command,
    operator,
    safety,
    interpretation,
    riskIndicators,
    recommendation,
    mutatesFlags: false,
    blocksFinanceService: false,
  };
}
