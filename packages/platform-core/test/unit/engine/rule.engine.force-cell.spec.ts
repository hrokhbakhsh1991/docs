import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  testRuleContextWithForceCell,
} from "../../fixtures/rule-context.fixture.js";
import {
  testStarterFieldRegistry,
  testStarterRuleSet,
} from "../../fixtures/starter.fixture.js";
import { PlatformCoreError } from "../../../src/errors/platform-core.error.js";
import { RuleEngine } from "../../../src/engine/rule.engine.js";
import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";
import {
  DEFAULT_RULE_ENGINE_SCOPE_POLICY,
  type RuleEngineScopePolicy,
} from "../../../src/engine/rule-engine-scope-policy.js";
import { RULE_ENGINE_TEST_SCOPE_POLICY } from "../../rule-engine-test-policy.js";

function makeEngine(
  scopePolicy: RuleEngineScopePolicy = DEFAULT_RULE_ENGINE_SCOPE_POLICY,
): RuleEngine {
  return RuleEngine.create(
    testStarterRuleSet(),
    FieldRegistryEngine.create(testStarterFieldRegistry()),
    scopePolicy,
  );
}

function resolveCellId(
  engine: RuleEngine,
  context: ReturnType<typeof testRuleContextWithForceCell>,
): string {
  return engine.createScope(context).resolveCellId();
}

/** Excluded from phase-1 closure gate — tests forceCellId instrumentation only. */
describe("RuleEngine forceCellId (test-only policy)", () => {
  it("returns requested cell when valid", () => {
    const engine = makeEngine(RULE_ENGINE_TEST_SCOPE_POLICY);
    assert.equal(
      resolveCellId(engine, testRuleContextWithForceCell({ variant: "other" }, "default")),
      "default",
    );
  });

  it("throws INVALID_RULE_CONTEXT under production scope policy", () => {
    const engine = makeEngine();
    assert.throws(
      () =>
        resolveCellId(engine, testRuleContextWithForceCell({ variant: "default" }, "default")),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_CONTEXT");
        return true;
      },
    );
  });

  it("throws INVALID_RULE_SET when cell missing", () => {
    const engine = makeEngine(RULE_ENGINE_TEST_SCOPE_POLICY);
    assert.throws(
      () =>
        resolveCellId(engine, testRuleContextWithForceCell({ variant: "default" }, "missing")),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "INVALID_RULE_SET");
        return true;
      },
    );
  });
});
