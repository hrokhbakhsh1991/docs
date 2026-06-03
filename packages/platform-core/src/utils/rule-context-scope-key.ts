import type { RuleContextResolution } from "../types/rule-context-resolution";
import { assertTenantId } from "./rule-context-tenant";
import { filterRuleContextDimensions } from "./rule-context-dimensions";
import { normalizeRuleContext } from "./rule-context";

function normalizeDimensionValue(value: string): string {
  return value.normalize("NFC");
}

/**
 * Dimension-only cache key (tenant-agnostic segment, NFC-normalized values).
 */
export function buildRuleContextDimensionKey(
  context: RuleContextResolution,
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
  context: RuleContextResolution,
  matrixDimensions: readonly string[],
): string {
  const normalized = normalizeRuleContext(context);
  const tenantId = assertTenantId(normalized);
  const dimensionKey = buildRuleContextDimensionKey(normalized, matrixDimensions);
  return `t:${tenantId}\0${dimensionKey}`;
}
