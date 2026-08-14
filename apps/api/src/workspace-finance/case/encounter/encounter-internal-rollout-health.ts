/**
 * PR16-A — Internal rollout health report (report-only).
 * Extends observation window with verdict / completeness / exception distributions.
 * Never mutates flags; never blocks FinanceService.
 */

import {
  buildEncounterRolloutReport,
  type BuildEncounterRolloutReportInput,
  type EncounterRolloutReport,
} from "./encounter-rollout-report";
import type { EncounterTelemetryEvent } from "./encounter-telemetry";

export type EncounterVerdictSample = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly reading: string;
  readonly completenessClass: string;
  readonly surfaceState?: string;
};

export type EncounterDistributionCounts = Readonly<Record<string, number>>;

export type EncounterInternalMeaningSummary = {
  readonly sampleCount: number;
  readonly verdictDistribution: EncounterDistributionCounts;
  readonly completenessDistribution: EncounterDistributionCounts;
  readonly exceptionRate: number | null;
  readonly exceptionCount: number;
};

export type EncounterInternalProviderDegradationSummary = {
  readonly eventCount: number;
  readonly byProvider: EncounterDistributionCounts;
  readonly byReason: EncounterDistributionCounts;
  readonly optionalEventCount: number;
  readonly ledgerEventCount: number;
  readonly tenantsAffected: readonly string[];
};

export type EncounterInternalRolloutHealthReport = EncounterRolloutReport & {
  readonly meaningSummary: EncounterInternalMeaningSummary;
  readonly providerDegradationSummary: EncounterInternalProviderDegradationSummary;
  readonly tenantScope: EncounterRolloutReport["tenantScope"] & {
    readonly internalTenants: readonly string[];
  };
  readonly shadowEnabled: false;
  readonly commandUiEnabled: false;
};

function countBy(values: readonly string[]): EncounterDistributionCounts {
  const out: Record<string, number> = {};
  for (const v of values) {
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export function summarizeEncounterMeaningSamples(
  samples: readonly EncounterVerdictSample[]
): EncounterInternalMeaningSummary {
  const readings = samples.map((s) => s.reading);
  const completeness = samples.map((s) => s.completenessClass);
  const exceptionCount = samples.filter((s) => s.reading === "EXCEPTION").length;
  return {
    sampleCount: samples.length,
    verdictDistribution: countBy(readings),
    completenessDistribution: countBy(completeness),
    exceptionCount,
    exceptionRate: samples.length === 0 ? null : exceptionCount / samples.length,
  };
}

export function summarizeProviderDegradationEvents(
  events: readonly EncounterTelemetryEvent[]
): EncounterInternalProviderDegradationSummary {
  const deg = events.filter((e) => e.kind === "provider_degradation");
  const byProvider: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  const tenants = new Set<string>();
  let optionalEventCount = 0;
  let ledgerEventCount = 0;
  for (const e of deg) {
    if (e.kind !== "provider_degradation") continue;
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + 1;
    byReason[e.failureReason] = (byReason[e.failureReason] ?? 0) + 1;
    tenants.add(e.tenantId);
    if (e.optional) optionalEventCount += 1;
    if (e.provider === "ledger") ledgerEventCount += 1;
  }
  return {
    eventCount: deg.length,
    byProvider,
    byReason,
    optionalEventCount,
    ledgerEventCount,
    tenantsAffected: [...tenants].sort(),
  };
}

export type BuildEncounterInternalRolloutHealthReportInput = BuildEncounterRolloutReportInput & {
  readonly internalTenants?: readonly string[];
  readonly meaningSamples?: readonly EncounterVerdictSample[];
};

/**
 * Compose internal rollout health dashboard contract.
 */
export function buildEncounterInternalRolloutHealthReport(
  input: BuildEncounterInternalRolloutHealthReportInput
): EncounterInternalRolloutHealthReport {
  const base = buildEncounterRolloutReport(input);
  return {
    ...base,
    tenantScope: {
      ...base.tenantScope,
      internalTenants: input.internalTenants ?? [],
    },
    meaningSummary: summarizeEncounterMeaningSamples(input.meaningSamples ?? []),
    providerDegradationSummary: summarizeProviderDegradationEvents(input.events),
    shadowEnabled: false,
    commandUiEnabled: false,
  };
}
