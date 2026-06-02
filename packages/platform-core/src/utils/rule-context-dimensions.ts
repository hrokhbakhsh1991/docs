import { PlatformCoreError } from "../errors/platform-core.error";

const MAX_DIMENSION_VALUE_LENGTH = 64_000;

/**
 * Keeps only keys declared in ruleSet.matrixDimensions; rejects unknown dimension keys.
 */
export function filterRuleContextDimensions(
  dimensions: Readonly<Record<string, string>>,
  matrixDimensions: readonly string[],
): Record<string, string> {
  const allowed = new Set(matrixDimensions);
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(dimensions)) {
    if (!allowed.has(key)) {
      throw new PlatformCoreError(
        "INVALID_RULE_CONTEXT",
        `RuleContext.dimensions key "${key}" is not in ruleSet.matrixDimensions`,
        { key, matrixDimensions: [...matrixDimensions] },
      );
    }
    if (value.length > MAX_DIMENSION_VALUE_LENGTH) {
      throw new PlatformCoreError(
        "INVALID_RULE_CONTEXT",
        `RuleContext.dimensions value for "${key}" exceeds maximum length (${MAX_DIMENSION_VALUE_LENGTH})`,
        { key, length: value.length },
      );
    }
    filtered[key] = value;
  }

  return filtered;
}
