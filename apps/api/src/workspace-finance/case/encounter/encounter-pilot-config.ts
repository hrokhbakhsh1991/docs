/**
 * Pilot rollout configuration helpers (PR13-B).
 * Manual activation only — never auto-enable/disable from health.
 */

import {
  FINANCE_CASE_ENCOUNTER_MODE_ENV,
  FINANCE_CASE_ENCOUNTER_PILOT_TENANTS_ENV,
  parseFinanceCaseEncounterPilotTenantAllowlist,
  resolveFinanceCaseEncounterRolloutMode,
  type FinanceCaseEncounterRolloutMode,
} from "./finance-case-encounter-rollout";
import {
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
  isFinanceCaseEncounterEmergencyDisabled,
} from "./encounter-production-decision";

export type EncounterPilotRolloutConfig = {
  readonly mode: FinanceCaseEncounterRolloutMode;
  readonly pilotTenants: ReadonlySet<string>;
  readonly emergencyDisabled: boolean;
  readonly isPilotMode: boolean;
};

/**
 * Read explicit pilot configuration from env (report / ops tooling).
 * Does not mutate flags.
 */
export function resolveEncounterPilotRolloutConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): EncounterPilotRolloutConfig {
  const mode = resolveFinanceCaseEncounterRolloutMode(env);
  const allowlist = parseFinanceCaseEncounterPilotTenantAllowlist(env);
  return {
    mode,
    pilotTenants: allowlist ?? new Set(),
    emergencyDisabled: isFinanceCaseEncounterEmergencyDisabled(env),
    isPilotMode: mode === "pilot",
  };
}

export function isPilotTenant(
  tenantId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const allowlist = parseFinanceCaseEncounterPilotTenantAllowlist(env);
  return allowlist !== null && allowlist.has(tenantId.trim());
}

/** Env keys documented for pilot activation. */
export const ENCOUNTER_PILOT_ENV_KEYS = {
  mode: FINANCE_CASE_ENCOUNTER_MODE_ENV,
  pilotTenants: FINANCE_CASE_ENCOUNTER_PILOT_TENANTS_ENV,
  emergencyDisable: FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV,
} as const;
