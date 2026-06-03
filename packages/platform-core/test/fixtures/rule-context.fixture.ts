import type { RuleContext } from "../../src/types/rule-context.js";
import type { RuleContextResolution } from "../../src/types/rule-context-resolution.js";

export const TEST_TENANT_ID = "test-tenant";

export function testRuleContext(
  dimensions: Readonly<Record<string, string>>,
  overrides?: Partial<Omit<RuleContext, "dimensions">>,
): RuleContext {
  return {
    tenantId: TEST_TENANT_ID,
    dimensions,
    ...overrides,
  };
}

/** Test-only resolution input (may include `forceCellId`). */
export function testRuleContextResolution(
  dimensions: Readonly<Record<string, string>>,
  overrides?: Partial<Omit<RuleContextResolution, "dimensions">>,
): RuleContextResolution {
  return {
    tenantId: TEST_TENANT_ID,
    dimensions,
    ...overrides,
  };
}

export function testRuleContextWithForceCell(
  dimensions: Readonly<Record<string, string>>,
  forceCellId: string,
  overrides?: Partial<Omit<RuleContextResolution, "dimensions" | "forceCellId">>,
): RuleContextResolution {
  return testRuleContextResolution(dimensions, { ...overrides, forceCellId });
}
