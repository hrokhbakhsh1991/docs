import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCanonicalDocument,
  parseCanonicalDocumentFromStorage,
  parseWorkspacePluginFromStorage,
  starterWorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { testRuleContext } from "../src/__fixtures__/rule-context.fixture";
import { RuleEngine } from "../src/engine/rule.engine";
import { FieldRegistryEngine } from "../src/engine/field-registry.engine";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine";
import {
  starterFieldRegistry,
  starterRuleSet,
} from "../src/__fixtures__/starter.fixture";
import { buildRuleContextScopeKey } from "../src/utils/rule-context-scope-key";

function makeEngine(): RuleEngine {
  return new RuleEngine(starterRuleSet, new FieldRegistryEngine(starterFieldRegistry));
}

describe("runtime isolation — cross-tenant scope signatures", () => {
  it("buildRuleContextScopeKey prefixes tenant boundary with t: and isolates tenants", () => {
    const dimensions = { variant: "default" };
    const keyA = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: "tenant_a" }),
      ["variant"],
    );
    const keyB = buildRuleContextScopeKey(
      testRuleContext(dimensions, { tenantId: "tenant_b" }),
      ["variant"],
    );
    assert.match(keyA, /^t:tenant_a\0/);
    assert.match(keyB, /^t:tenant_b\0/);
    assert.notEqual(keyA, keyB);

    const engine = makeEngine();
    const scopeA = engine.createScope(testRuleContext(dimensions, { tenantId: "tenant_a" }));
    const scopeB = engine.createScope(testRuleContext(dimensions, { tenantId: "tenant_b" }));
    assert.notEqual(scopeA, scopeB);
  });
});

describe("runtime isolation — unicode NFC dimension equality", () => {
  it("NFC and NFD dimension variants share the same scope cache entry", () => {
    const engine = makeEngine();
    const nfc = "\u00e9";
    const nfd = "e\u0301";
    const scopeNfc = engine.createScope(
      testRuleContext({ variant: nfc }, { tenantId: "tenant_nfc" }),
    );
    const scopeNfd = engine.createScope(
      testRuleContext({ variant: nfd }, { tenantId: "tenant_nfc" }),
    );
    assert.equal(scopeNfc, scopeNfd);
  });
});

describe("runtime isolation — storage ingress immutability", () => {
  it("parseCanonicalDocumentFromStorage returns a deep-frozen clone", () => {
    const source = {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        basics: { title: "Tour" },
      },
    };
    const parsed = parseCanonicalDocumentFromStorage(source);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.data), true);
    assert.equal(Object.isFrozen(parsed.data.basics), true);
    assert.notEqual(parsed.data, source.data);
  });

  it("parseWorkspacePluginFromStorage returns a deep-frozen clone", () => {
    const parsed = parseWorkspacePluginFromStorage(starterWorkspacePlugin);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.fieldRegistry), true);
    assert.throws(() => {
      Object.defineProperty(parsed, "id", { value: "mutated" });
    });
    assert.equal(parsed.id, starterWorkspacePlugin.id);
  });
});

describe("runtime isolation — concurrent scope cache resilience", () => {
  it("parallel scope resolution preserves tenant boundaries under load", async () => {
    const engine = makeEngine();
    const tasks = Array.from({ length: 400 }, (_, index) => {
      const tenantId = `iso_${index % 8}`;
      const variant = index % 2 === 0 ? "default" : "default";
      return Promise.resolve().then(() =>
        engine.createScope(testRuleContext({ variant }, { tenantId })),
      );
    });
    const scopes = await Promise.all(tasks);
    const reference = engine.createScope(
      testRuleContext({ variant: "default" }, { tenantId: "iso_0" }),
    );
    for (let i = 0; i < scopes.length; i += 8) {
      assert.equal(scopes[i], reference);
    }
    assert.notEqual(
      engine.createScope(testRuleContext({ variant: "default" }, { tenantId: "iso_0" })),
      engine.createScope(testRuleContext({ variant: "default" }, { tenantId: "iso_1" })),
    );
  });

  it("parallel validateCanonical on shared engine remains green", async () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "Tour" },
        details: { summary: "Summary" },
      },
    });
    const tasks = Array.from({ length: 200 }, (_, index) =>
      Promise.resolve().then(() =>
        engine.validateCanonical(
          document,
          testRuleContext({ variant: "default" }, { tenantId: `t_${index % 10}` }),
        ),
      ),
    );
    const results = await Promise.all(tasks);
    assert.equal(results.every((result) => result.ok), true);
  });
});
