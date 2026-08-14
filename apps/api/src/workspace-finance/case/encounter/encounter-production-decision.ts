/**
 * Production rollout decision layer above strategy (PR13-A).
 * Observable reasons; never blocks FinanceService mutations.
 * Health recommendations never auto-mutate flags — HEALTH_HOLD is operator-set.
 */

import {
  resolveFinanceCaseEncounterRollout,
  resolveFinanceCaseEncounterRolloutMode,
  type FinanceCaseEncounterRolloutDecision,
  type FinanceCaseEncounterRolloutMode,
  type ResolveFinanceCaseEncounterRolloutInput,
} from "./finance-case-encounter-rollout";

export const FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV =
  "FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE";
export const FINANCE_CASE_ENCOUNTER_HEALTH_HOLD_ENV = "FINANCE_CASE_ENCOUNTER_HEALTH_HOLD";

export type EncounterProductionDecisionReason =
  | "enabled"
  | "tenant_not_allowed"
  | "sample_skipped"
  | "health_hold"
  | "emergency_disabled";

export type EncounterProductionDecision =
  | {
      readonly run: true;
      readonly reason: "enabled";
      readonly mode: Exclude<FinanceCaseEncounterRolloutMode, "disabled">;
      readonly strategy: Extract<FinanceCaseEncounterRolloutDecision, { run: true }>;
    }
  | {
      readonly run: false;
      readonly reason: Exclude<EncounterProductionDecisionReason, "enabled">;
      readonly mode: FinanceCaseEncounterRolloutMode;
      readonly strategy: FinanceCaseEncounterRolloutDecision;
    };

function isEnvFlagOn(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string
): boolean {
  const raw = env[key];
  if (raw === undefined || raw === null) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isFinanceCaseEncounterEmergencyDisabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return isEnvFlagOn(env, FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV);
}

export function isFinanceCaseEncounterHealthHold(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return isEnvFlagOn(env, FINANCE_CASE_ENCOUNTER_HEALTH_HOLD_ENV);
}

export type ResolveEncounterProductionDecisionInput = ResolveFinanceCaseEncounterRolloutInput;

/**
 * Decide whether Encounter Case execution may run in production.
 * Order: emergency disable → strategy → operator health_hold.
 * Authz remains a separate gate (never bypassed).
 */
export function resolveEncounterProductionDecision(
  input: ResolveEncounterProductionDecisionInput
): EncounterProductionDecision {
  const env = input.env ?? process.env;
  const mode = input.mode ?? resolveFinanceCaseEncounterRolloutMode(env);

  if (isFinanceCaseEncounterEmergencyDisabled(env) || mode === "disabled") {
    const strategy = resolveFinanceCaseEncounterRollout({
      ...input,
      mode: "disabled",
      enabled: false,
    });
    return {
      run: false,
      reason: "emergency_disabled",
      mode: "disabled",
      strategy,
    };
  }

  const strategy = resolveFinanceCaseEncounterRollout(input);
  if (!strategy.run) {
    const reason: "tenant_not_allowed" | "sample_skipped" | "emergency_disabled" =
      strategy.reason === "tenant_excluded"
        ? "tenant_not_allowed"
        : strategy.reason === "sampled_out"
          ? "sample_skipped"
          : "emergency_disabled";
    return {
      run: false,
      reason,
      mode: strategy.mode,
      strategy,
    };
  }

  if (isFinanceCaseEncounterHealthHold(env)) {
    return {
      run: false,
      reason: "health_hold",
      mode: strategy.mode,
      strategy,
    };
  }

  return {
    run: true,
    reason: "enabled",
    mode: strategy.mode,
    strategy,
  };
}
