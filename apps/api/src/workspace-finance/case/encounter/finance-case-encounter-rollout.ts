/**
 * Host rollout controls for Case Encounter HTTP (PR12-B / PR12-C).
 * Flag OFF / mode disabled → zero Case execution.
 * Never gates FinanceService mutations.
 */

export const FINANCE_CASE_ENCOUNTER_ENABLED_ENV = "FINANCE_CASE_ENCOUNTER_ENABLED";
export const FINANCE_CASE_ENCOUNTER_TENANTS_ENV = "FINANCE_CASE_ENCOUNTER_TENANTS";
export const FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV =
  "FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS";
export const FINANCE_CASE_ENCOUNTER_PILOT_TENANTS_ENV = "FINANCE_CASE_ENCOUNTER_PILOT_TENANTS";
export const FINANCE_CASE_ENCOUNTER_SAMPLE_RATE_ENV = "FINANCE_CASE_ENCOUNTER_SAMPLE_RATE";
export const FINANCE_CASE_ENCOUNTER_MODE_ENV = "FINANCE_CASE_ENCOUNTER_MODE";

/**
 * Explicit operator rollout strategy.
 * Ladder: disabled → pilot → internal → sampled → full
 */
export type FinanceCaseEncounterRolloutMode =
  | "disabled"
  | "pilot"
  | "internal"
  | "sampled"
  | "full";

export type FinanceCaseEncounterRolloutDecision =
  | {
      readonly run: true;
      readonly mode: Exclude<FinanceCaseEncounterRolloutMode, "disabled">;
    }
  | {
      readonly run: false;
      readonly mode: FinanceCaseEncounterRolloutMode;
      readonly reason: "disabled" | "tenant_excluded" | "sampled_out";
    };

export function isFinanceCaseEncounterEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const mode = resolveFinanceCaseEncounterRolloutMode(env);
  return mode !== "disabled";
}

/**
 * Resolve explicit MODE, else derive from legacy ENABLED + TENANTS + SAMPLE_RATE.
 */
export function resolveFinanceCaseEncounterRolloutMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): FinanceCaseEncounterRolloutMode {
  const rawMode = env[FINANCE_CASE_ENCOUNTER_MODE_ENV];
  if (rawMode !== undefined && rawMode !== null && String(rawMode).trim().length > 0) {
    const normalized = String(rawMode).trim().toLowerCase();
    if (
      normalized === "disabled" ||
      normalized === "pilot" ||
      normalized === "internal" ||
      normalized === "sampled" ||
      normalized === "full"
    ) {
      return normalized;
    }
    return "disabled";
  }

  if (!isLegacyEnabledFlag(env)) {
    return "disabled";
  }
  const allowlist = parseFinanceCaseEncounterTenantAllowlist(env);
  const rate = parseFinanceCaseEncounterSampleRate(env);
  if (allowlist !== null && rate >= 1) {
    return "internal";
  }
  if (rate < 1) {
    return "sampled";
  }
  return "full";
}

function isLegacyEnabledFlag(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  const raw = env[FINANCE_CASE_ENCOUNTER_ENABLED_ENV];
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** Comma-separated tenant allowlist. Empty / unset → all tenants when enabled. */
export function parseFinanceCaseEncounterTenantAllowlist(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ReadonlySet<string> | null {
  const raw = env[FINANCE_CASE_ENCOUNTER_TENANTS_ENV];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) {
    return null;
  }
  const ids = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return ids.length === 0 ? null : new Set(ids);
}

/** Internal-tenant allowlist (MODE=internal). Falls back to TENANTS. */
export function parseFinanceCaseEncounterInternalTenantAllowlist(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ReadonlySet<string> | null {
  const raw = env[FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV];
  if (raw !== undefined && raw !== null && String(raw).trim().length > 0) {
    const ids = String(raw)
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return ids.length === 0 ? null : new Set(ids);
  }
  return parseFinanceCaseEncounterTenantAllowlist(env);
}

/** Pilot-tenant allowlist (MODE=pilot). Empty / unset → nobody (fail closed). */
export function parseFinanceCaseEncounterPilotTenantAllowlist(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): ReadonlySet<string> | null {
  const raw = env[FINANCE_CASE_ENCOUNTER_PILOT_TENANTS_ENV];
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
export function parseFinanceCaseEncounterSampleRate(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): number {
  const raw = env[FINANCE_CASE_ENCOUNTER_SAMPLE_RATE_ENV];
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

export type ResolveFinanceCaseEncounterRolloutInput = {
  readonly tenantId: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Injected RNG for tests — default Math.random. */
  readonly random?: () => number;
  /** Explicit override of global enable (tests / legacy). */
  readonly enabled?: boolean;
  /** Explicit strategy override (tests). */
  readonly mode?: FinanceCaseEncounterRolloutMode;
};

/**
 * Decide whether Encounter Case execution may run.
 * Order: strategy mode → tenant allowlist → sample rate (sampled only).
 * Authz is applied separately and is never bypassed by these flags.
 */
export function resolveFinanceCaseEncounterRollout(
  input: ResolveFinanceCaseEncounterRolloutInput
): FinanceCaseEncounterRolloutDecision {
  const env = input.env ?? process.env;
  const mode =
    input.mode ??
    (input.enabled === false
      ? "disabled"
      : input.enabled === true
        ? resolveFinanceCaseEncounterRolloutMode({
            ...env,
            [FINANCE_CASE_ENCOUNTER_ENABLED_ENV]: "1",
            [FINANCE_CASE_ENCOUNTER_MODE_ENV]: undefined,
          })
        : resolveFinanceCaseEncounterRolloutMode(env));

  if (mode === "disabled") {
    return { run: false, mode, reason: "disabled" };
  }

  if (mode === "pilot") {
    const allowlist = parseFinanceCaseEncounterPilotTenantAllowlist(env);
    if (allowlist === null || !allowlist.has(input.tenantId.trim())) {
      return { run: false, mode, reason: "tenant_excluded" };
    }
    return { run: true, mode };
  }

  if (mode === "internal") {
    const allowlist = parseFinanceCaseEncounterInternalTenantAllowlist(env);
    if (allowlist === null || !allowlist.has(input.tenantId.trim())) {
      return { run: false, mode, reason: "tenant_excluded" };
    }
    return { run: true, mode };
  }

  if (mode === "sampled") {
    const allowlist = parseFinanceCaseEncounterTenantAllowlist(env);
    if (allowlist !== null && !allowlist.has(input.tenantId.trim())) {
      return { run: false, mode, reason: "tenant_excluded" };
    }
    const rate = parseFinanceCaseEncounterSampleRate(env);
    if (rate <= 0) {
      return { run: false, mode, reason: "sampled_out" };
    }
    if (rate < 1) {
      const roll = (input.random ?? Math.random)();
      if (roll >= rate) {
        return { run: false, mode, reason: "sampled_out" };
      }
    }
    return { run: true, mode };
  }

  // full
  return { run: true, mode: "full" };
}
