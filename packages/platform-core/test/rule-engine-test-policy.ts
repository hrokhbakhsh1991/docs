import type { RuleEngineScopePolicy } from "../src/engine/rule-engine-scope-policy.js";

/** Injected in tests that exercise forceCellId — never used in production. */
export const RULE_ENGINE_TEST_SCOPE_POLICY: RuleEngineScopePolicy = Object.freeze({
  allowForceCellId: true,
});
