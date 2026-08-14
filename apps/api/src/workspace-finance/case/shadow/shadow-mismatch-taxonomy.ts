/**
 * PR16-B — Operator-facing shadow mismatch taxonomy.
 * Maps Host comparison engine categories (+ notes) without changing finance-core.
 */

import type {
  FinanceCaseComparisonCategory,
  ShadowMismatchTaxonomyCode,
} from "../comparison/comparison-taxonomy-types";

export type { ShadowMismatchTaxonomyCode } from "../comparison/comparison-taxonomy-types";

export type MapShadowMismatchTaxonomyInput = {
  readonly category: FinanceCaseComparisonCategory;
  readonly notes?: readonly string[];
  /** When compare engine already tagged completeness / signal. */
  readonly taxonomyHints?: readonly ShadowMismatchTaxonomyCode[];
};

/**
 * Prefer explicit hints from the comparison engine; else map legacy categories.
 */
export function mapShadowMismatchTaxonomy(
  input: MapShadowMismatchTaxonomyInput
): ShadowMismatchTaxonomyCode {
  if (input.taxonomyHints !== undefined && input.taxonomyHints.length > 0) {
    const first = input.taxonomyHints[0]!;
    if (first !== "ALIGNED") {
      return first;
    }
  }

  switch (input.category) {
    case "aligned":
      return "ALIGNED";
    case "reading_disagreement":
      return "VERDICT_MISMATCH";
    case "owner_disagreement":
      return "OWNERSHIP_MISMATCH";
    case "exception_disagreement":
      return "EXCEPTION_MISMATCH";
    case "eligibility_disagreement":
      return "ELIGIBILITY_MISMATCH";
    case "uncomparable": {
      const notes = input.notes ?? [];
      if (
        notes.some(
          (n) =>
            n.includes("incomplete") ||
            n.includes("degraded") ||
            n.includes("missing_fact") ||
            n.includes("required_fact")
        )
      ) {
        return "MISSING_FACT_COVERAGE";
      }
      return "UNCOMPARABLE";
    }
    default: {
      const _exhaustive: never = input.category;
      void _exhaustive;
      return "UNCOMPARABLE";
    }
  }
}
