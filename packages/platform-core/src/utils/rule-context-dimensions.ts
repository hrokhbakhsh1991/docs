import { PlatformCoreError } from "../errors/platform-core.error";

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
    filtered[key] = value;
  }

  return filtered;
}
