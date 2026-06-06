import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { FieldRegistryEngine } from "../../../src/engine/field-registry.engine.js";
import { RuleEngine } from "../../../src/engine/rule.engine.js";
import { validateCanonicalDocument } from "../../../src/engine/validate-canonical-document.js";
import { createTestStarterPlugin } from "../../fixtures/starter.fixture.js";
import { testRuleContextResolution } from "../../fixtures/rule-context.fixture.js";
import { documentWithRuntimePoison } from "../../lib/canonical-document-poison.js";

function runValidate(
  plugin: WorkspacePlugin,
  document: Parameters<typeof validateCanonicalDocument>[0]["document"]
) {
  const fieldEngine = FieldRegistryEngine.create(plugin.fieldRegistry);
  const ruleEngine = RuleEngine.create(plugin.ruleSet, fieldEngine);
  return validateCanonicalDocument({
    plugin,
    fieldEngine,
    ruleEngine,
    document,
    context: testRuleContextResolution({ variant: "default" }),
  });
}

function pluginWithPricingField(inactiveGroups: readonly string[]): WorkspacePlugin {
  return {
    ...createTestStarterPlugin(),
    fieldRegistry: {
      version: 1,
      fields: [
        ...createTestStarterPlugin().fieldRegistry.fields,
        {
          id: "details.pricingAmount",
          canonicalPath: "details.pricingAmount",
          stepId: "details",
          kind: "text",
          required: true,
          groupSlug: "pricing",
        },
      ],
    },
    wizard: {
      ...createTestStarterPlugin().wizard,
      inactiveFieldGroups: [...inactiveGroups],
    },
  };
}

describe("validateCanonicalDocument — direct unit", () => {
  it("returns ok for a valid starter-shaped document", () => {
    const plugin = createTestStarterPlugin();
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "My tour" }, details: { summary: "Summary text" } },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, true);
    assert.deepEqual(result.violations, []);
  });

  it("reports REQUIRED_FIELD_EMPTY for a missing visible required field", () => {
    const plugin = createTestStarterPlugin();
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: { basics: { title: "" }, details: { summary: "Summary text" } },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "REQUIRED_FIELD_EMPTY");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("skips invalid fields in inactiveFieldGroups but still validates active fields", () => {
    const plugin = pluginWithPricingField(["pricing"]);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {},
        details: { summary: "Summary text", pricingAmount: 99999 },
      },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.fieldId === "basics.title"));
    assert.ok(!result.violations.some((v) => v.fieldId === "details.pricingAmount"));
  });

  it("validates inactive group fields when the group is active", () => {
    const plugin = pluginWithPricingField([]);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", pricingAmount: 99999 },
      },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some(
        (v) => v.fieldId === "details.pricingAmount" && v.code === "CANONICAL_TYPE_MISMATCH"
      )
    );
  });

  it("allows hidden composite values without HIDDEN_FIELD_POISON", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.meta",
            canonicalPath: "details.meta",
            stepId: "details",
            kind: "composite",
            required: false,
          },
        ],
      },
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
        cells: [
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: [
              { fieldId: "basics.title", required: true, hidden: false },
              { fieldId: "details.summary", hidden: false },
              { fieldId: "details.meta", hidden: true },
            ],
          },
        ],
      },
    };
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "" },
        details: { meta: { note: "internal" } },
      },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.fieldId === "basics.title"));
    assert.ok(!result.violations.some((v) => v.code === "HIDDEN_FIELD_POISON"));
  });

  it("reports HIDDEN_FIELD_POISON for hidden non-composite values", () => {
    const plugin: WorkspacePlugin = {
      ...createTestStarterPlugin(),
      fieldRegistry: {
        version: 1,
        fields: [
          ...createTestStarterPlugin().fieldRegistry.fields,
          {
            id: "details.secret",
            canonicalPath: "details.secret",
            stepId: "details",
            kind: "text",
            required: false,
          },
        ],
      },
      ruleSet: {
        ...createTestStarterPlugin().ruleSet,
        cells: [
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: [
              { fieldId: "basics.title", required: true, hidden: false },
              { fieldId: "details.summary", hidden: false },
              { fieldId: "details.secret", hidden: true },
            ],
          },
        ],
      },
    };
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text", secret: "leak" },
      },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "HIDDEN_FIELD_POISON");
    assert.equal(result.violations[0]?.fieldId, "details.secret");
  });

  it("maps canonical ingress failures to ValidationResult violations", () => {
    const plugin = createTestStarterPlugin();
    const document = documentWithRuntimePoison({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: 1n },
        details: { summary: "Summary text" },
      },
    });
    const result = runValidate(plugin, document);
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "SANITIZE_BIGINT_NOT_ALLOWED");
  });
});
