/**
 * PR5-A comparison barrel — host observation only.
 */

export {
  compareFinanceCaseObservation,
  projectInterpreterClassification,
  type FinanceCaseComparisonCategory,
  type FinanceCaseComparisonInput,
  type FinanceCaseComparisonResult,
  type InterpreterClassification,
} from "./compare-finance-case-observation";
export { type ShadowMismatchTaxonomyCode } from "./comparison-taxonomy-types";
export {
  classifyOperationalObservation,
  type OperationalFinanceCategory,
  type OperationalFollowUpOwner,
  type OperationalObservation,
  type OperationalObservationSource,
} from "./operational-observation";
export { loadOperationalObservation } from "./load-operational-observation";
export {
  createInMemoryFinanceCaseComparisonEmitter,
  summarizeOperationalForObservation,
  type FinanceCaseComparisonEmitter,
  type FinanceCaseComparisonMetrics,
  type FinanceCaseComparisonObservation,
} from "./comparison-observation";
