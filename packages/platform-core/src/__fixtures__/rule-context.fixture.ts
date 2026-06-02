import type { RuleContext } from "../types/rule-context";

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
