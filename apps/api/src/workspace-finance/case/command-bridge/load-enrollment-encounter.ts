/**
 * Fresh enrollment Case execution → EncounterView (PR9-B re-execution / PR11-C composition).
 */

import {
  executeFinanceCase,
  projectCaseEncounter,
  type CaseEncounterView,
  type CaseOutput,
} from "@app-tour/finance-core/case";

import {
  composeDenaliCaseFactProviders,
  resolveDenaliCaseCapabilityFromEnv,
  type DenaliCaseCapabilityConfig,
} from "../compose-denali-case-providers";
import {
  buildEnrollmentCaseScope,
  HostDenaliCaseReadSource,
  type HostDenaliCaseReadDeps,
} from "../host-denali-case-read-source";
import type { CaseEncounterLoadResult } from "./types";

export type LoadEnrollmentCaseEncounterInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly readDeps: Omit<HostDenaliCaseReadDeps, "tenantId">;
  readonly discoveryAttention?: {
    readonly attentionClass: string;
    readonly reasonCode?: string;
  } | null;
  readonly executionId?: string;
  /**
   * PR11-C — optional payment/recon capability.
   * When omitted, env defaults (manual, recon off).
   */
  readonly capability?: DenaliCaseCapabilityConfig;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

/**
 * Host-owned load: compose → assemble → interpret → project EncounterView.
 * Never patches a prior CaseOutput. Never mutates SoTs.
 */
export async function loadEnrollmentCaseEncounter(
  input: LoadEnrollmentCaseEncounterInput
): Promise<CaseEncounterLoadResult> {
  const source = new HostDenaliCaseReadSource({
    tenantId: input.tenantId,
    ...input.readDeps,
  });
  const capability =
    input.capability ??
    resolveDenaliCaseCapabilityFromEnv(input.env ?? process.env);
  const providers = composeDenaliCaseFactProviders({ source, capability });
  const scope = buildEnrollmentCaseScope({
    registrationId: input.registrationId,
    counterpartyId: input.counterpartyId,
  });
  const executed = await executeFinanceCase(providers, {
    scope,
    mode: "lookup",
    includeLedger: true,
    includeSignal: true,
    executionId: input.executionId,
  });
  const encounter: CaseEncounterView = projectCaseEncounter(executed.caseOutput, {
    discoveryAttention:
      input.discoveryAttention ??
      executed.snapshot.encounter.attention ??
      null,
  });
  return {
    caseOutput: executed.caseOutput,
    encounter,
    executionId: executed.diagnostics.executionId,
    providerObservation: {
      degradedProviders: executed.diagnostics.degradedProviders,
      providers: executed.diagnostics.providers,
    },
  };
}

/** Test helper — project without Host SoT reads. */
export function encounterFromCaseOutput(
  caseOutput: CaseOutput,
  executionId: string
): CaseEncounterLoadResult {
  return {
    caseOutput,
    encounter: projectCaseEncounter(caseOutput),
    executionId,
  };
}
