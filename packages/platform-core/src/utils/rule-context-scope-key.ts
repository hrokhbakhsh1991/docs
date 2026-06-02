import type { RuleContext } from "../types/rule-context";
import { filterRuleContextDimensions } from "./rule-context-dimensions";
import { normalizeRuleContext } from "./rule-context";
import { assertRuleContextTenantId } from "./rule-context-tenant";

/**
 * Dimension-only cache key (tenant-agnostic segment).
 */
export function buildRuleContextDimensionKey(
  context: RuleContext,
  matrixDimensions: readonly string[],
): string {
  if (context.forceCellId != null) {
    return `\0force\0${context.forceCellId}`;
  }

  const filtered = filterRuleContextDimensions(context.dimensions, matrixDimensions);
  const parts: string[] = [];
  for (const key of matrixDimensions) {
    const value = filtered[key];
    if (value !== undefined) {
      parts.push(`${key}\0${value}`);
    }
  }
  return parts.join("\0");
}

/**
 * Full scope cache key — tenant prefix + dimension signature (mirrors scope normalization).
 */
export function buildRuleContextScopeKey(
  context: RuleContext,
  matrixDimensions: readonly string[],
): string {
  const normalized = normalizeRuleContext(context);
  const tenantId = assertRuleContextTenantId(normalized);
  const dimensionKey = buildRuleContextDimensionKey(normalized, matrixDimensions);
  return `\0tenant\0${tenantId}\0${dimensionKey}`;
}
