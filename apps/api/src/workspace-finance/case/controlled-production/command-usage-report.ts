/**
 * PR20 — Controlled command usage observation report (report-only).
 * Compares classic vs Command UI review outcomes without normalizing systems.
 */

import type { ControlledProductionDiscrepancyClass } from "./discrepancy-class";
import type { ControlledProductionRecommendation } from "./recommendation";
import type { ControlledProductionHealthReport } from "./health-report";

export type ControlledCommandScenarioId = "A" | "B" | "C" | "D" | "E" | "F";

export type ControlledCommandScenarioEvidence = {
  readonly id: ControlledCommandScenarioId;
  readonly name: string;
  readonly evidenceClass: "LIVE" | "AUTOMATED" | "FIXTURE";
  readonly status: "PASS" | "FAIL" | "SKIP";
  readonly detail: string;
  readonly httpStatus?: number;
  readonly receiptId?: string;
  readonly registrationId?: string;
  readonly executionIdBefore?: string;
  readonly executionIdAfter?: string;
  readonly bookingPaymentBefore?: string;
  readonly bookingPaymentAfter?: string;
  readonly receiptStillPending?: boolean;
  readonly latencyMs?: number;
  readonly errorCode?: string;
};

export type ClassicVsCommandComparison = {
  readonly scenarioId: ControlledCommandScenarioId;
  readonly receiptStateAligned: boolean | null;
  readonly bookingPaymentAligned: boolean | null;
  readonly meaningRefreshOk: boolean | null;
  readonly classification: ControlledProductionDiscrepancyClass | null;
  readonly notes: string;
};

export type ControlledCommandUsageOperatorReport = {
  readonly confirmationCompletion: number;
  readonly cancellationBeforeSubmit: number;
  readonly returnToOperational: number;
  readonly repeatedAttempts: number;
  readonly staleRetries: number;
  readonly unavailableOrTimeout: number;
  readonly meaningOpenToSubmitMs: readonly number[];
  readonly submitToMeaningRefreshMs: readonly number[];
  readonly humanFeedback: "NO_HUMAN_FEEDBACK" | "RECORDED";
};

export type ControlledCommandUsageReport = {
  readonly tenantId: string;
  readonly observationWindow: {
    readonly startedAtMs: number;
    readonly endedAtMs: number;
  };
  readonly scenarios: readonly ControlledCommandScenarioEvidence[];
  readonly classicVsCommand: readonly ClassicVsCommandComparison[];
  readonly operator: ControlledCommandUsageOperatorReport;
  readonly health: ControlledProductionHealthReport | null;
  readonly safety: {
    readonly unauthorizedMutationObserved: false | true;
    readonly staleSecondMutationObserved: false | true;
    readonly crossTenantCommandUiEnabled: false | true;
    readonly caseDirectMutationObserved: false | true;
  };
  readonly recommendation: ControlledProductionRecommendation;
  readonly mutatesFlags: false;
};

export type BuildControlledCommandUsageReportInput = {
  readonly tenantId: string;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly scenarios: readonly ControlledCommandScenarioEvidence[];
  readonly classicVsCommand: readonly ClassicVsCommandComparison[];
  readonly operator: ControlledCommandUsageOperatorReport;
  readonly health: ControlledProductionHealthReport | null;
  readonly recommendation: ControlledProductionRecommendation;
  readonly unauthorizedMutationObserved?: boolean;
  readonly staleSecondMutationObserved?: boolean;
  readonly crossTenantCommandUiEnabled?: boolean;
  readonly caseDirectMutationObserved?: boolean;
};

export function buildControlledCommandUsageReport(
  input: BuildControlledCommandUsageReportInput
): ControlledCommandUsageReport {
  return {
    tenantId: input.tenantId,
    observationWindow: {
      startedAtMs: input.startedAtMs,
      endedAtMs: input.endedAtMs,
    },
    scenarios: input.scenarios,
    classicVsCommand: input.classicVsCommand,
    operator: input.operator,
    health: input.health,
    safety: {
      unauthorizedMutationObserved: input.unauthorizedMutationObserved === true,
      staleSecondMutationObserved: input.staleSecondMutationObserved === true,
      crossTenantCommandUiEnabled: input.crossTenantCommandUiEnabled === true,
      caseDirectMutationObserved: input.caseDirectMutationObserved === true,
    },
    recommendation: input.recommendation,
    mutatesFlags: false,
  };
}

export function countLiveCommandSuccesses(
  scenarios: readonly ControlledCommandScenarioEvidence[]
): number {
  return scenarios.filter(
    (s) =>
      s.evidenceClass === "LIVE" &&
      s.status === "PASS" &&
      (s.id === "A" || s.id === "B") &&
      s.httpStatus === 200
  ).length;
}
