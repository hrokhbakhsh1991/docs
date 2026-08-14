/**
 * PR16-C — Shadow validation report (parity metrics + taxonomy).
 * Report-only — never mutates flags, SoTs, or FinanceService.
 */

import type { FinanceCaseComparisonObservation } from "../comparison/comparison-observation";
import {
  mapShadowMismatchTaxonomy,
  type ShadowMismatchTaxonomyCode,
} from "./shadow-mismatch-taxonomy";
import { buildFinanceCaseShadowReport } from "./build-finance-case-shadow-report";

export type ShadowValidationTaxonomyDistribution = Readonly<
  Record<
    | "VERDICT_MISMATCH"
    | "COMPLETENESS_MISMATCH"
    | "OWNERSHIP_MISMATCH"
    | "SIGNAL_MISMATCH"
    | "MISSING_FACT_COVERAGE"
    | "UNCOMPARABLE"
    | "ALIGNED"
    | "EXCEPTION_MISMATCH"
    | "ELIGIBILITY_MISMATCH",
    number
  >
>;

export type FinanceCaseShadowValidationReport = {
  readonly totalComparisons: number;
  readonly comparableCases: number;
  readonly verdictMatchPct: number | null;
  readonly completenessMatchPct: number | null;
  readonly ownershipMatchPct: number | null;
  readonly signalMatchPct: number | null;
  readonly taxonomyDistribution: ShadowValidationTaxonomyDistribution;
  readonly mismatchTaxonomy: Readonly<Record<string, number>>;
  readonly affectedTenants: readonly string[];
  readonly affectedCaseKeys: readonly string[];
  readonly caseKeysByTenant: Readonly<Record<string, readonly string[]>>;
  readonly providerDegradationEvents: number;
  readonly missingRequiredFactCount: number;
  readonly criticalOwnershipMismatchCount: number;
  readonly unexplainedVerdictDivergenceCount: number;
  readonly generatedAtMs: number;
  readonly mutatesFlags: false;
  readonly blocksFinanceService: false;
  readonly affectsPrimaryResponse: false;
  readonly writesCasePersistence: false;
};

export type BuildFinanceCaseShadowValidationReportInput = {
  readonly observations: readonly FinanceCaseComparisonObservation[];
  readonly tenantIds?: readonly (string | null | undefined)[];
  readonly now?: () => number;
};

function emptyTaxonomy(): Record<string, number> {
  return {
    ALIGNED: 0,
    VERDICT_MISMATCH: 0,
    COMPLETENESS_MISMATCH: 0,
    OWNERSHIP_MISMATCH: 0,
    SIGNAL_MISMATCH: 0,
    MISSING_FACT_COVERAGE: 0,
    UNCOMPARABLE: 0,
    EXCEPTION_MISMATCH: 0,
    ELIGIBILITY_MISMATCH: 0,
  };
}

function taxonomyOf(obs: FinanceCaseComparisonObservation): ShadowMismatchTaxonomyCode {
  return (
    obs.taxonomyCode ??
    mapShadowMismatchTaxonomy({
      category: obs.category,
      notes: obs.notes,
    })
  );
}

function isNonComparable(code: ShadowMismatchTaxonomyCode): boolean {
  return code === "UNCOMPARABLE" || code === "MISSING_FACT_COVERAGE";
}

function matchPct(matched: number, denom: number): number | null {
  if (denom <= 0) return null;
  return matched / denom;
}

function isMissingRequiredFact(obs: FinanceCaseComparisonObservation): boolean {
  const code = taxonomyOf(obs);
  if (code !== "MISSING_FACT_COVERAGE") return false;
  const notes = obs.notes.join(" ");
  // Optional ledger/signal degradation is accepted (PR15-H) — not a required-fact hold.
  if (notes.includes("missing_fact_optional")) return false;
  if (obs.degradedProviders.every((p) => p === "ledger" || p === "signal")) {
    return false;
  }
  return true;
}

/**
 * Build PR16-C validation report from comparison observations.
 */
export function buildFinanceCaseShadowValidationReport(
  input: BuildFinanceCaseShadowValidationReportInput
): FinanceCaseShadowValidationReport {
  const base = buildFinanceCaseShadowReport(input);
  const taxonomyDistribution = emptyTaxonomy();
  const caseKeysByTenant: Record<string, string[]> = {};

  let verdictOk = 0;
  let completenessOk = 0;
  let ownershipOk = 0;
  let signalOk = 0;
  let comparable = 0;
  let missingRequiredFactCount = 0;
  let criticalOwnershipMismatchCount = 0;
  let unexplainedVerdictDivergenceCount = 0;

  input.observations.forEach((obs, index) => {
    const code = taxonomyOf(obs);
    taxonomyDistribution[code] = (taxonomyDistribution[code] ?? 0) + 1;

    const tenantId = input.tenantIds?.[index];
    if (typeof tenantId === "string" && tenantId.trim().length > 0 && obs.caseKey) {
      const t = tenantId.trim();
      if (caseKeysByTenant[t] === undefined) caseKeysByTenant[t] = [];
      caseKeysByTenant[t]!.push(obs.caseKey);
    }

    if (isMissingRequiredFact(obs)) {
      missingRequiredFactCount += 1;
    }

    if (isNonComparable(code)) {
      return;
    }

    comparable += 1;

    const verdictMatch = code !== "VERDICT_MISMATCH" && code !== "EXCEPTION_MISMATCH";
    const completenessMatch = code !== "COMPLETENESS_MISMATCH";
    const ownershipMatch = code !== "OWNERSHIP_MISMATCH";
    const signalMatch = code !== "SIGNAL_MISMATCH";

    if (verdictMatch) verdictOk += 1;
    if (completenessMatch) completenessOk += 1;
    if (ownershipMatch) ownershipOk += 1;
    if (signalMatch) signalOk += 1;

    if (code === "OWNERSHIP_MISMATCH") {
      criticalOwnershipMismatchCount += 1;
    }

    if (code === "VERDICT_MISMATCH" && obs.notes.length === 0) {
      unexplainedVerdictDivergenceCount += 1;
    }
  });

  return {
    totalComparisons: base.totalComparisons,
    comparableCases: comparable,
    verdictMatchPct: matchPct(verdictOk, comparable),
    completenessMatchPct: matchPct(completenessOk, comparable),
    ownershipMatchPct: matchPct(ownershipOk, comparable),
    signalMatchPct: matchPct(signalOk, comparable),
    taxonomyDistribution: taxonomyDistribution as ShadowValidationTaxonomyDistribution,
    mismatchTaxonomy: base.mismatchByTaxonomy,
    affectedTenants: base.affectedTenants,
    affectedCaseKeys: base.affectedCaseKeys,
    caseKeysByTenant: Object.fromEntries(
      Object.entries(caseKeysByTenant).map(([k, v]) => [k, [...new Set(v)].sort()])
    ),
    providerDegradationEvents: base.providerDegradationEvents,
    missingRequiredFactCount,
    criticalOwnershipMismatchCount,
    unexplainedVerdictDivergenceCount,
    generatedAtMs: base.generatedAtMs,
    mutatesFlags: false,
    blocksFinanceService: false,
    affectsPrimaryResponse: false,
    writesCasePersistence: false,
  };
}
