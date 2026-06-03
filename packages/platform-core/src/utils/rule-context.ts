import { PlatformCoreError } from "../errors/platform-core.error";
import type { RuleContextResolution } from "../types/rule-context-resolution";
import { assertTenantId } from "./rule-context-tenant";

/**
 * Normalizes rule context dimensions: null/undefined → `{}`; rejects non-plain objects.
 */
export function normalizeRuleContext(context: RuleContextResolution): RuleContextResolution {
  if (context == null || typeof context !== "object") {
    throw new PlatformCoreError("INVALID_RULE_CONTEXT", "RuleContext is required");
  }

  const tenantId = assertTenantId(context);

  const rawDimensions = context.dimensions;
  if (rawDimensions == null) {
    return { ...context, tenantId, dimensions: {} };
  }

  if (typeof rawDimensions !== "object" || Array.isArray(rawDimensions)) {
    throw new PlatformCoreError(
      "INVALID_RULE_CONTEXT",
      "RuleContext.dimensions must be a plain object",
    );
  }

  const dimensions: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawDimensions)) {
    if (typeof value !== "string") {
      throw new PlatformCoreError(
        "INVALID_RULE_CONTEXT",
        `RuleContext.dimensions["${key}"] must be a string`,
      );
    }
    dimensions[key] = value.normalize("NFC");
  }

  return {
    ...context,
    tenantId,
    dimensions,
  };
}
