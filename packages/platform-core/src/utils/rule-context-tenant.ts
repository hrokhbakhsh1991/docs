import { PlatformCoreError } from "../errors/platform-core.error";
import type { RuleContext } from "../types/rule-context";

/** Dev slug token for cache partitioning (alphanumeric + _-). */
const TENANT_SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,127}$/i;

/** Registry / provisioning UUID (Phase 4.3 seeds, Phase 6.6 smoke tenant). */
const TENANT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidTenantId(value: string): boolean {
  return TENANT_SLUG_PATTERN.test(value) || TENANT_UUID_PATTERN.test(value);
}

/**
 * Validates `RuleContext.tenantId` — single authority for normalize + scope cache keys.
 */
export function assertTenantId(context: RuleContext): string {
  if (typeof context.tenantId !== "string") {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId is required and must be a non-empty string"
    );
  }

  if (context.tenantId.length === 0 || context.tenantId.trim() === "") {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId is required and must be a non-empty string"
    );
  }

  if (context.tenantId !== context.tenantId.trim()) {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId must not contain leading or trailing whitespace"
    );
  }

  if (!isValidTenantId(context.tenantId)) {
    throw new PlatformCoreError(
      "INVALID_RULE_CONTEXT",
      `RuleContext.tenantId "${context.tenantId}" has invalid format`
    );
  }

  return context.tenantId;
}

/** @deprecated Use {@link assertTenantId}. */
export const assertRuleContextTenantId = assertTenantId;
