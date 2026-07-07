import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliFieldPolicyDefinitions,
  DENALI_FIELD_POLICY_WORKSPACE_TYPE,
} from "../src/field-policy/denali-field-policy-definitions";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";
import * as denaliPublicApi from "../src/index";

describe("denali field policy definitions", () => {
  it("exports platform field definitions from the Denali workspace registry", () => {
    const registry = buildDenaliWorkspaceFieldRegistry();
    const definitions = buildDenaliFieldPolicyDefinitions(registry);

    assert.equal(definitions.length, registry.fields.length);

    for (const field of registry.fields) {
      const definition = definitions.find((candidate) => candidate.id === field.id);
      assert.ok(definition, `missing field policy definition for ${field.id}`);
      assert.equal(definition.workspaceType, DENALI_FIELD_POLICY_WORKSPACE_TYPE);
      assert.equal(definition.canonicalPath, field.canonicalPath);
      assert.equal(definition.kind, field.kind);
      assert.equal(definition.version, registry.version);
    }
  });

  it("keeps Denali implementation details out of platform field definitions", () => {
    const [definition] = buildDenaliFieldPolicyDefinitions();

    assert.ok(definition);
    assert.equal("stepId" in definition, false);
    assert.equal("rhfPath" in definition, false);
    assert.equal("zodPath" in definition, false);
    assert.equal("wire" in definition, false);
    assert.equal("contextualVisibility" in definition, false);
    assert.equal("contextualRequired" in definition, false);
  });

  it("preserves enum options as validation metadata", () => {
    const definitions = buildDenaliFieldPolicyDefinitions();
    const category = definitions.find((definition) => definition.canonicalPath === "category");

    assert.ok(category);
    assert.equal(category.kind, "enum");
    assert.ok(Array.isArray(category.validation?.enumOptions));
    assert.ok((category.validation?.enumOptions as readonly string[]).length > 0);
  });

  it("exports the metadata bridge from the Denali package facade", () => {
    assert.equal(
      denaliPublicApi.DENALI_FIELD_POLICY_WORKSPACE_TYPE,
      DENALI_FIELD_POLICY_WORKSPACE_TYPE
    );
    assert.equal(typeof denaliPublicApi.buildDenaliFieldPolicyDefinitions, "function");
  });
});
