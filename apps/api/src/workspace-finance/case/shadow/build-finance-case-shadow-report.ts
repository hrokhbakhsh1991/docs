/**
 * PR16-B — Shadow comparison report (report-only).
 */

import type { FinanceCaseComparisonObservation } from "../comparison/comparison-observation";
import {
  mapShadowMismatchTaxonomy,
  type ShadowMismatchTaxonomyCode,
} from "./shadow-mismatch-taxonomy";

export type FinanceCaseShadowReport = {
  readonly totalComparisons: number;
  readonly matchedCount: number;
  readonly matchedPercentage: number | null;
  readonly mismatchByTaxonomy: Readonly<Record<string, number>>;
  readonly mismatchByEngineCategory: Readonly<Record<string, number>>;
  readonly affectedTenants: readonly string[];
  readonly affectedCaseKeys: readonly string[];
  readonly uncomparableCount: number;
  readonly providerDegradationEvents: number;
  readonly generatedAtMs: number;
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
  readonly affectsPrimaryResponse: false;
};

export type BuildFinanceCaseShadowReportInput = {
  readonly observations: readonly FinanceCaseComparisonObservation[];
  /** Optional tenant ids parallel to observations (when not on observation). */
  readonly tenantIds?: readonly (string | null | undefined)[];
  readonly now?: () => number;
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Aggregate comparison observations into an operator shadow report.
 */
export function buildFinanceCaseShadowReport(
  input: BuildFinanceCaseShadowReportInput
): FinanceCaseShadowReport {
  const now = input.now ?? Date.now;
  const mismatchByTaxonomy: Record<string, number> = {};
  const mismatchByEngineCategory: Record<string, number> = {};
  const tenants = new Set<string>();
  const caseKeys = new Set<string>();
  let matchedCount = 0;
  let uncomparableCount = 0;
  let providerDegradationEvents = 0;

  input.observations.forEach((obs, index) => {
    const tenantId = input.tenantIds?.[index];
    if (typeof tenantId === "string" && tenantId.trim().length > 0) {
      tenants.add(tenantId.trim());
    }
    if (obs.caseKey !== null && obs.caseKey.trim().length > 0) {
      caseKeys.add(obs.caseKey);
    }
    if (obs.degradedProviders.length > 0) {
      providerDegradationEvents += 1;
    }

    bump(mismatchByEngineCategory, obs.category);
    const taxonomy =
      obs.taxonomyCode ??
      mapShadowMismatchTaxonomy({
        category: obs.category,
        notes: obs.notes,
      });
    bump(mismatchByTaxonomy, taxonomy);

    if (taxonomy === "ALIGNED") {
      matchedCount += 1;
    } else if (taxonomy === "UNCOMPARABLE" || taxonomy === "MISSING_FACT_COVERAGE") {
      uncomparableCount += 1;
    }
  });

  const total = input.observations.length;
  const comparableMatchedDenom = total - uncomparableCount;
  const matchedPercentage =
    comparableMatchedDenom <= 0
      ? total === 0
        ? null
        : 0
      : matchedCount / comparableMatchedDenom;

  return {
    totalComparisons: total,
    matchedCount,
    matchedPercentage,
    mismatchByTaxonomy,
    mismatchByEngineCategory,
    affectedTenants: [...tenants].sort(),
    affectedCaseKeys: [...caseKeys].sort(),
    uncomparableCount,
    providerDegradationEvents,
    generatedAtMs: now(),
    mutatesFlags: false,
    blocksFinanceService: false,
    affectsPrimaryResponse: false,
  };
}

export type { ShadowMismatchTaxonomyCode };
