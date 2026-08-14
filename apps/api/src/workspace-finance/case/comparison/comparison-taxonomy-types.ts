/**
 * Shared comparison/taxonomy types to avoid shadow<->comparison import cycles.
 */

export type FinanceCaseComparisonCategory =
  | "aligned"
  | "owner_disagreement"
  | "reading_disagreement"
  | "exception_disagreement"
  | "eligibility_disagreement"
  | "uncomparable";

export type ShadowMismatchTaxonomyCode =
  | "ALIGNED"
  | "VERDICT_MISMATCH"
  | "COMPLETENESS_MISMATCH"
  | "OWNERSHIP_MISMATCH"
  | "SIGNAL_MISMATCH"
  | "MISSING_FACT_COVERAGE"
  | "EXCEPTION_MISMATCH"
  | "ELIGIBILITY_MISMATCH"
  | "UNCOMPARABLE";
