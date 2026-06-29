import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  adaptWorkspaceFieldRegistryToFieldDefinitions,
  adaptWorkspaceFieldPolicyManifest,
  adaptWorkspaceRuleSetToFieldPolicy,
  evaluateSimpleCondition,
  filterDeliveryEligibleFields,
  resolveFieldState,
  FIELD_POLICY_ENTITY_PATH,
  type FieldDefinition,
  type FieldPolicyRule,
} from "../../../src/index.js";

describe("field-policy public API", () => {
  it("exports pure resolver and adapter from the platform-core facade", () => {
    assert.equal(typeof evaluateSimpleCondition, "function");
    assert.equal(typeof resolveFieldState, "function");
    assert.equal(typeof filterDeliveryEligibleFields, "function");
    assert.equal(typeof adaptWorkspaceFieldRegistryToFieldDefinitions, "function");
    assert.equal(typeof adaptWorkspaceFieldPolicyManifest, "function");
    assert.equal(typeof adaptWorkspaceRuleSetToFieldPolicy, "function");
    assert.equal(typeof FIELD_POLICY_ENTITY_PATH.tour, "function");
  });

  it("allows consumers to resolve field state via the root package facade", () => {
    const definitions: readonly FieldDefinition[] = [
      {
        id: "title",
        workspaceType: "starter",
        canonicalPath: "title",
        kind: "text",
        version: 1,
      },
    ];
    const rules: readonly FieldPolicyRule[] = [
      {
        id: "title-public",
        workspaceType: "starter",
        fieldId: "title",
        surface: "public_website",
        state: "visible",
        priority: 1,
        enabled: true,
      },
    ];

    assert.deepEqual(
      resolveFieldState({
        tenantId: "tenant-1",
        workspaceType: "starter",
        surface: "public_website",
        entityState: {},
        definitions,
        rules,
      }),
      [{ fieldId: "title", canonicalPath: "title", state: "visible", reasonRuleId: "title-public" }],
    );
  });

  it("keeps field policy exports on the single platform-core facade", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      exports?: Record<string, unknown>;
    };

    assert.deepEqual(Object.keys(packageJson.exports ?? {}).sort(), [".", "./*"]);
    assert.equal(packageJson.exports?.["./*"], null);
  });
});
