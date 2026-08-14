/**
 * Host rollout controls for Case shadow + comparison (PR5-A / PR5-B / PR16-B).
 * Flag OFF → zero shadow and zero comparison.
 * Cost controls never change primary workflow latency.
 * PR16-B: empty SHADOW_TENANTS fail closed; internal mode intersects INTERNAL_TENANTS.
 */

import {
  parseFinanceCaseEncounterInternalTenantAllowlist,
  resolveFinanceCaseEncounterRolloutMode,
} from "./encounter/finance-case-encounter-rollout";

export const FINANCE_CASE_SHADOW_ENV = "FINANCE_CASE_SHADOW_ENABLED";
export const FINANCE_CASE_SHADOW_TENANTS_ENV = "FINANCE_CASE_SHADOW_TENANTS";
export const FINANCE_CASE_SHADOW_SAMPLE_RATE_ENV = "FINANCE_CASE_SHADOW_SAMPLE_RATE";
/** Comma allowlist of shadow triggers (PR5-B). Empty / unset → all triggers. */
export const FINANCE_CASE_SHADOW_TRIGGERS_ENV = "FINANCE_CASE_SHADOW_TRIGGERS";
/** When 1/true — skip second ops SoT fan-out (shadow Case only). */
export const FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS_ENV =
  "FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS";

export type FinanceCaseShadowRolloutDecision =
  | { readonly run: true }
  | {
      readonly run: false;
      readonly reason: "disabled" | "tenant_excluded" | "sampled_out" | "trigger_excluded";
    };

export function isFinanceCaseShadowEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = env[FINANCE_CASE_SHADOW_ENV];
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Comma-separated tenant allowlist.
 * Empty / unset → null (PR16-B fail closed when shadow enabled — nobody runs).
 */
export function parseFinanceCaseShadowTenantAllowlist(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ReadonlySet<string> | null {
  const raw = env[FINANCE_CASE_SHADOW_TENANTS_ENV];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) {
    return null;
  }
  const ids = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return ids.length === 0 ? null : new Set(ids);
}

/**
 * Sample rate in [0, 1]. Unset → 1 (all selected tenants).
 * Invalid values fail closed to 0.
 */
export function parseFinanceCaseShadowSampleRate(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): number {
  const raw = env[FINANCE_CASE_SHADOW_SAMPLE_RATE_ENV];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) {
    return 1;
  }
  const parsed = Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}

/** Comma-separated trigger allowlist. Empty / unset → all triggers. */
export function parseFinanceCaseShadowTriggerAllowlist(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ReadonlySet<string> | null {
  const raw = env[FINANCE_CASE_SHADOW_TRIGGERS_ENV];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) {
    return null;
  }
  const ids = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return ids.length === 0 ? null : new Set(ids);
}

export function isFinanceCaseShadowSkipComparisonReads(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = env[FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS_ENV];
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export type ResolveFinanceCaseShadowRolloutInput = {
  readonly tenantId: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Injected RNG for tests — default Math.random. */
  readonly random?: () => number;
  /** Explicit override of global enable (tests). */
  readonly enabled?: boolean;
  /** When set, apply FINANCE_CASE_SHADOW_TRIGGERS allowlist (PR5-B). */
  readonly trigger?: string;
};

/**
 * Decide whether this trigger should run shadow + comparison.
 * Order: global flag → shadow tenant allowlist (fail closed) →
 * internal intersection (when MODE=internal) → trigger allowlist → sample rate.
 */
export function resolveFinanceCaseShadowRollout(
  input: ResolveFinanceCaseShadowRolloutInput
): FinanceCaseShadowRolloutDecision {
  const env = input.env ?? process.env;
  const enabled = input.enabled ?? isFinanceCaseShadowEnabled(env);
  if (!enabled) {
    return { run: false, reason: "disabled" };
  }
  const tenantId = input.tenantId.trim();
  const allowlist = parseFinanceCaseShadowTenantAllowlist(env);
  // PR16-B: empty / unset allowlist fails closed (never all tenants).
  if (allowlist === null || !allowlist.has(tenantId)) {
    return { run: false, reason: "tenant_excluded" };
  }
  // When Encounter is in internal mode, shadow only for internal allowlisted tenants.
  if (resolveFinanceCaseEncounterRolloutMode(env) === "internal") {
    const internal = parseFinanceCaseEncounterInternalTenantAllowlist(env);
    if (internal === null || !internal.has(tenantId)) {
      return { run: false, reason: "tenant_excluded" };
    }
  }
  if (input.trigger !== undefined) {
    const triggers = parseFinanceCaseShadowTriggerAllowlist(env);
    if (triggers !== null && !triggers.has(input.trigger.trim())) {
      return { run: false, reason: "trigger_excluded" };
    }
  }
  const rate = parseFinanceCaseShadowSampleRate(env);
  if (rate <= 0) {
    return { run: false, reason: "sampled_out" };
  }
  if (rate < 1) {
    const roll = (input.random ?? Math.random)();
    if (roll >= rate) {
      return { run: false, reason: "sampled_out" };
    }
  }
  return { run: true };
}
