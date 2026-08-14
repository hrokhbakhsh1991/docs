/**
 * PR18-B / PR19 — Fail-closed Command UI rollout (single tenant only).
 * Never auto-enables; never grants Host permission.
 * PR19: also fail closed on Encounter↔Command mismatch / emergency disable when those envs are present.
 */

export const FINANCE_CASE_COMMAND_UI_ENABLED_ENV = "FINANCE_CASE_COMMAND_UI_ENABLED";
export const FINANCE_CASE_COMMAND_UI_TENANT_ENV = "FINANCE_CASE_COMMAND_UI_TENANT";
export const FINANCE_CASE_ENCOUNTER_MODE_ENV = "FINANCE_CASE_ENCOUNTER_MODE";
export const FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV =
  "FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS";
export const FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV =
  "FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE";
export const FINANCE_CASE_SHADOW_ENABLED_ENV = "FINANCE_CASE_SHADOW_ENABLED";

function truthyFlag(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Command UI chrome may render only when ENABLED and TENANT matches session.
 * Empty tenant or multi-value lists → fail closed (PR18-B is single-tenant).
 * PR19: emergency disable / shadow on / Encounter allowlist mismatch → fail closed when configured.
 */
export function isFinanceCaseCommandUiEnabledForTenant(
  tenantId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (!truthyFlag(env[FINANCE_CASE_COMMAND_UI_ENABLED_ENV])) {
    return false;
  }
  if (truthyFlag(env[FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE_ENV])) {
    return false;
  }
  if (truthyFlag(env[FINANCE_CASE_SHADOW_ENABLED_ENV])) {
    // PR19 observation lock: Command UI stays off while shadow is unexpectedly on.
    return false;
  }
  const configured = (env[FINANCE_CASE_COMMAND_UI_TENANT_ENV] ?? "").trim();
  if (configured.length === 0) {
    return false;
  }
  if (configured.includes(",")) {
    return false;
  }
  const sessionTenant = tenantId.trim();
  if (sessionTenant.length === 0 || sessionTenant !== configured) {
    return false;
  }

  const encounterMode = (env[FINANCE_CASE_ENCOUNTER_MODE_ENV] ?? "").trim().toLowerCase();
  const encounterRaw = (env[FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS_ENV] ?? "").trim();
  if (encounterMode === "internal" || encounterRaw.length > 0) {
    if (encounterMode !== "internal") {
      return false;
    }
    const allow = encounterRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (allow.length === 0 || !allow.includes(configured) || !allow.includes(sessionTenant)) {
      return false;
    }
  }

  return true;
}
