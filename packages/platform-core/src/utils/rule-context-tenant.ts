import { PlatformCoreError } from "../errors/platform-core.error";
import type { RuleContext } from "../types/rule-context";

/** Safe tenant token for cache partitioning (alphanumeric + _-). */
const TENANT_ID_PATTERN = /^[a-z][a-z0-9_-]{0,127}$/i;

/**
 * Validates `RuleContext.tenantId` — single authority for normalize + scope cache keys.
 */
export function assertTenantId(context: RuleContext): string {
  if (typeof context.tenantId !== "string") {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId is required and must be a non-empty string",
    );
  }

  if (context.tenantId.length === 0 || context.tenantId.trim() === "") {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId is required and must be a non-empty string",
    );
  }

  if (context.tenantId !== context.tenantId.trim()) {
    throw new PlatformCoreError(
      "TENANT_ISOLATION_VIOLATION",
      "RuleContext.tenantId must not contain leading or trailing whitespace",
    );
  }

  if (!TENANT_ID_PATTERN.test(context.tenantId)) {
    throw new PlatformCoreError(
      "INVALID_RULE_CONTEXT",
      `RuleContext.tenantId "${context.tenantId}" has invalid format`,
    );
  }

  return context.tenantId;
}

/** @deprecated Use {@link assertTenantId}. */
export const assertRuleContextTenantId = assertTenantId;
