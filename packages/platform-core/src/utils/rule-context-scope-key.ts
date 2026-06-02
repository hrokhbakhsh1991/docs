import type { RuleContext } from "../types/rule-context";
import { filterRuleContextDimensions } from "./rule-context-dimensions";
import { normalizeRuleContext } from "./rule-context";

/**
 * Stable cache key for RuleEngineScope reuse (mirrors scope normalization + filtering).
 */
export function buildRuleContextScopeKey(
  context: RuleContext,
  matrixDimensions: readonly string[],
): string {
  const normalized = normalizeRuleContext(context);
  if (normalized.forceCellId != null) {
    return `\0force\0${normalized.forceCellId}`;
  }

  const filtered = filterRuleContextDimensions(normalized.dimensions, matrixDimensions);
  const parts: string[] = [];
  for (const key of matrixDimensions) {
    const value = filtered[key];
    if (value !== undefined) {
      parts.push(`${key}\0${value}`);
    }
  }
  return parts.join("\0");
}
