/**
 * Internal rollout configuration helpers (PR16-A).
 * Manual activation only — never auto-enable from health.
 */

import {
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV,
  FINANCE_CASE_ENCOUNTER_MODE_ENV,
  FINANCE_CASE_ENCOUNTER_TENANTS_ENV,
  parseFinanceCaseEncounterInternalTenantAllowlist,
  resolveFinanceCaseEncounterRolloutMode,
  type FinanceCaseEncounterRolloutMode,
} from "./finance-case-encounter-rollout";
import {
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
  isFinanceCaseEncounterEmergencyDisabled,
} from "./encounter-production-decision";

export type EncounterInternalRolloutConfig = {
  readonly mode: FinanceCaseEncounterRolloutMode;
  readonly internalTenants: ReadonlySet<string>;
  readonly emergencyDisabled: boolean;
  readonly isInternalMode: boolean;
  /** Empty allowlist while MODE=internal → fail closed (nobody runs). */
  readonly failClosedEmptyAllowlist: true;
};

/**
 * Read explicit internal configuration from env (report / ops tooling).
 * Does not mutate flags.
 */
export function resolveEncounterInternalRolloutConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): EncounterInternalRolloutConfig {
  const mode = resolveFinanceCaseEncounterRolloutMode(env);
  const allowlist = parseFinanceCaseEncounterInternalTenantAllowlist(env);
  return {
    mode,
    internalTenants: allowlist ?? new Set(),
    emergencyDisabled: isFinanceCaseEncounterEmergencyDisabled(env),
    isInternalMode: mode === "internal",
    failClosedEmptyAllowlist: true,
  };
}

export function isInternalTenant(
  tenantId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const allowlist = parseFinanceCaseEncounterInternalTenantAllowlist(env);
  return allowlist !== null && allowlist.has(tenantId.trim());
}

/** Env keys documented for internal activation. */
export const ENCOUNTER_INTERNAL_ENV_KEYS = {
  mode: FINANCE_CASE_ENCOUNTER_MODE_ENV,
  internalTenants: FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV,
  tenantsFallback: FINANCE_CASE_ENCOUNTER_TENANTS_ENV,
  emergencyDisable: FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
} as const;
