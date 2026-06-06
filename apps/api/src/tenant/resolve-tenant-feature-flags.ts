import { isFeatureFlagFreezeActive } from "./feature-flag-freeze";
import { findTenantById, isStaticTenantRegistryAllowed } from "./tenant-registry";
import { resolveTenantThemeJsonById } from "./resolve-registered-tenant";
import { getCachedTenantById, getCachedTenantThemeById } from "./tenant-registry-cache";
import { isPersistedTenantUuid } from "./tenant-id-format";

/** Per-tenant runtime flags stored in `tenants.theme.featureFlags` (DEC-014). */
export type TenantFeatureFlags = {
  readonly advancedRuleEngine: boolean;
};

const ADVANCED_RULE_ENGINE_DEFAULT = true;

/**
 * Parses `theme.featureFlags.advancedRuleEngine` from tenant theme JSON.
 * Omitted or non-boolean values default to advanced (true).
 */
export function parseFeatureFlagsFromTheme(theme: unknown): TenantFeatureFlags {
  if (theme === null || typeof theme !== "object") {
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  const featureFlags = (theme as Record<string, unknown>).featureFlags;
  if (featureFlags === null || typeof featureFlags !== "object") {
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  const advancedRuleEngine = (featureFlags as Record<string, unknown>).advancedRuleEngine;
  return {
    advancedRuleEngine: advancedRuleEngine === false ? false : ADVANCED_RULE_ENGINE_DEFAULT,
  };
}

/** Maps feature flags to PlatformWizardEngine RuleContext variant. */
export function validationVariantForFeatureFlags(flags: TenantFeatureFlags): "default" | "basic" {
  return flags.advancedRuleEngine ? "default" : "basic";
}

/**
 * Resolves tenant feature flags — Postgres `tenants.theme` when DATABASE_URL set;
 * static registry only when {@link isStaticTenantRegistryAllowed}.
 * Unknown tenants default to advanced rules (fail-safe for validation strictness).
 */
export async function resolveTenantFeatureFlags(tenantId: string): Promise<TenantFeatureFlags> {
  const normalized = tenantId.trim();

  if (isStaticTenantRegistryAllowed()) {
    const registered = findTenantById(normalized);
    if (registered !== null) {
      return parseFeatureFlagsFromTheme(registered.theme);
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  if (!isPersistedTenantUuid(normalized)) {
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  if (isFeatureFlagFreezeActive()) {
    const cachedTheme = getCachedTenantThemeById(normalized);
    if (cachedTheme !== undefined) {
      return parseFeatureFlagsFromTheme(cachedTheme);
    }
    const cachedTenant = getCachedTenantById(normalized);
    if (cachedTenant !== undefined && cachedTenant !== null) {
      return parseFeatureFlagsFromTheme(cachedTenant.theme);
    }
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  const theme = await resolveTenantThemeJsonById(normalized);
  if (theme === null) {
    return { advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT };
  }

  return parseFeatureFlagsFromTheme(theme);
}
