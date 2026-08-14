/**
 * PR19 — Controlled production observation (report-only).
 */

export {
  normalizeDiscrepancyClass,
  summarizeDiscrepancyClasses,
  type ControlledProductionDiscrepancyClass,
  type ControlledProductionDiscrepancySample,
} from "./discrepancy-class";
export {
  evaluateControlledProductionRolloutSafety,
  type ControlledProductionRolloutSafety,
  type ControlledProductionRolloutSafetyInput,
} from "./rollout-safety";
export {
  recommendControlledProduction,
  type ControlledProductionRecommendation,
  type ControlledProductionRecommendationKind,
  type RecommendControlledProductionInput,
} from "./recommendation";
export {
  summarizeControlledProductionCommands,
  type CommandUiClientEvent,
  type CommandUiClientEventName,
  type ControlledProductionCommandSummary,
} from "./command-observation-summary";
export {
  buildControlledProductionHealthReport,
  type BuildControlledProductionHealthReportInput,
  type ControlledProductionEvidenceClass,
  type ControlledProductionHealthReport,
  type ControlledProductionInterpretationQuality,
  type ControlledProductionOperatorBehavior,
} from "./health-report";
export {
  buildControlledCommandUsageReport,
  countLiveCommandSuccesses,
  type BuildControlledCommandUsageReportInput,
  type ClassicVsCommandComparison,
  type ControlledCommandScenarioEvidence,
  type ControlledCommandScenarioId,
  type ControlledCommandUsageOperatorReport,
  type ControlledCommandUsageReport,
} from "./command-usage-report";
