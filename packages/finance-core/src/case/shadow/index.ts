/**
 * Case shadow barrel — re-exported via `@app-tour/finance-core/case` (PR4.5-B).
 */

export {
  runShadowFinanceCase,
  type ShadowExecutionFailed,
  type ShadowExecutionOk,
  type ShadowExecutionResult,
  type ShadowObservationSink,
} from "./run-shadow-finance-case";
export type {
  ShadowDiagnostics,
  ShadowExecutionRequest,
  ShadowObservationMetadata,
} from "./shadow-types";
