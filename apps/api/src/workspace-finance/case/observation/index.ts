/**
 * PR5-B observation barrel — calibration, coverage, gates, production sink.
 */

export {
  buildFactCoverageReport,
  type FactCoverageReport,
  type FactPresenceBucket,
  type ProviderCoverageName,
  type ProviderFactCoverage,
} from "./fact-coverage";
export {
  buildEncounterFactCoverageDiagnostic,
  classifyIncompleteCause,
  inferCompletenessInspectReasons,
  listCaseFactFieldDiagnostics,
  type CompletenessReasonInference,
  type CoverageCauseBucket,
  type EncounterFactCoverageDiagnostic,
  type TriFactFieldDiagnostic,
} from "./fact-coverage-diagnostics";
export {
  calibrateMismatch,
  type MismatchCalibrationClass,
  type MismatchCalibrationResult,
} from "./mismatch-calibration";
export {
  DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS,
  evaluateFinanceCaseQualityGates,
  type FinanceCaseQualityGateFinding,
  type FinanceCaseQualityGateReport,
  type FinanceCaseQualityGateThresholds,
  type FinanceCaseQualityGateCounters,
  type ProductionObservationRecord,
} from "./quality-gates";
export {
  assertObservationMetricsHaveNoPersistenceConcepts,
  createProductionObservationSink,
  type ProductionObservationMetrics,
  type ProductionObservationSink,
} from "./production-observation-sink";
