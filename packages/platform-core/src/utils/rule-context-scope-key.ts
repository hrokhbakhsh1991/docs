import type { RuleContext } from "../types/rule-context";
import { PlatformCoreError } from "../errors/platform-core.error";
import { filterRuleContextDimensions } from "./rule-context-dimensions";
import { normalizeRuleContext } from "./rule-context";

function assertTenantIdForScopeKey(context: RuleContext): string {
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
  return context.tenantId.trim();
}

function normalizeDimensionValue(value: string): string {
  return value.normalize("NFC");
}

/**
 * Dimension-only cache key (tenant-agnostic segment, NFC-normalized values).
 */
export function buildRuleContextDimensionKey(
  context: RuleContext,
  matrixDimensions: readonly string[],
): string {
  if (context.forceCellId != null) {
    return `\0force\0${normalizeDimensionValue(context.forceCellId)}`;
  }

  const filtered = filterRuleContextDimensions(context.dimensions, matrixDimensions);
  const parts: string[] = [];
  for (const key of matrixDimensions) {
    const value = filtered[key];
    if (value !== undefined) {
      parts.push(`${key}\0${normalizeDimensionValue(value)}`);
    }
  }
  return parts.join("\0");
}

/**
 * Full scope cache key — `t:${tenantId}` prefix + NFC-normalized dimension signature.
 */
export function buildRuleContextScopeKey(
  context: RuleContext,
  matrixDimensions: readonly string[],
): string {
  const normalized = normalizeRuleContext(context);
  const tenantId = assertTenantIdForScopeKey(normalized);
  const dimensionKey = buildRuleContextDimensionKey(normalized, matrixDimensions);
  return `t:${tenantId}\0${dimensionKey}`;
}
