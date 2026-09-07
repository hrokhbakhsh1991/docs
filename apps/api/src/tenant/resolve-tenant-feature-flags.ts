import { isFeatureFlagFreezeActive } from "./feature-flag-freeze";
import { findTenantById, isStaticTenantRegistryAllowed } from "./tenant-registry";
import { resolveTenantThemeJsonById } from "./resolve-registered-tenant";
import { getCachedTenantById, getCachedTenantThemeById } from "./tenant-registry-cache";
import { isPersistedTenantUuid } from "./tenant-id-format";

/** Per-tenant runtime flags stored in `tenants.theme.featureFlags` (DEC-014 / SK3). */
export type TenantFeatureFlags = {
  readonly advancedRuleEngine: boolean;
  /** When false, SK2.C skips in_app deliver for `registration.approved`. Default true. */
  readonly inAppRegistrationApprovedNotify: boolean;
};

const ADVANCED_RULE_ENGINE_DEFAULT = true;
/** SEC-042 — MNI inbox is canonical; legacy SK2.C deliver off unless tenant opts in. */
const IN_APP_REGISTRATION_APPROVED_NOTIFY_DEFAULT = false;

function defaults(): TenantFeatureFlags {
  return {
    advancedRuleEngine: ADVANCED_RULE_ENGINE_DEFAULT,
    inAppRegistrationApprovedNotify: IN_APP_REGISTRATION_APPROVED_NOTIFY_DEFAULT,
  };
}

/**
 * Parses `theme.featureFlags` from tenant theme JSON.
 * Omitted or non-boolean values use defaults (advanced rules on; legacy notify off).
 * Only explicit `false` disables a boolean flag.
 */
export function parseFeatureFlagsFromTheme(theme: unknown): TenantFeatureFlags {
  if (theme === null || typeof theme !== "object") {
    return defaults();
  }

  const featureFlags = (theme as Record<string, unknown>).featureFlags;
  if (featureFlags === null || typeof featureFlags !== "object") {
    return defaults();
  }

  const raw = featureFlags as Record<string, unknown>;
  const advancedRuleEngine = raw.advancedRuleEngine;
  const inAppRegistrationApprovedNotify = raw.inAppRegistrationApprovedNotify;
  return {
    advancedRuleEngine:
      advancedRuleEngine === false ? false : ADVANCED_RULE_ENGINE_DEFAULT,
    inAppRegistrationApprovedNotify:
      inAppRegistrationApprovedNotify === true
        ? true
        : inAppRegistrationApprovedNotify === false
          ? false
          : IN_APP_REGISTRATION_APPROVED_NOTIFY_DEFAULT,
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
    return defaults();
  }

  if (!isPersistedTenantUuid(normalized)) {
    return defaults();
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
    return defaults();
  }

  const theme = await resolveTenantThemeJsonById(normalized);
  if (theme === null) {
    return defaults();
  }

  return parseFeatureFlagsFromTheme(theme);
}
