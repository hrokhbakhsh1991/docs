import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { loadPlatformWizard } from "./load-platform-wizard.js";
import { createTestStarterPlugin } from "./fixtures/starter.fixture.js";
import { testRuleContext } from "./fixtures/rule-context.fixture.js";
import { documentWithRuntimePoison } from "./lib/canonical-document-poison.js";
import { PlatformCoreError } from "../src/errors/platform-core.error.js";
import type { ValidationResult } from "../src/types/validation-result.js";

type Outcome =
  | { readonly kind: "result"; readonly value: ValidationResult }
  | { readonly kind: "platform_core_error"; readonly error: PlatformCoreError }
  | { readonly kind: "raw"; readonly error: unknown };

function runValidateCanonical(
  engine: ReturnType<typeof loadPlatformWizard>,
  document: Parameters<typeof engine.validateCanonical>[0],
): Outcome {
  try {
    return {
      kind: "result",
      value: engine.validateCanonical(document, testRuleContext({ variant: "default" })),
    };
  } catch (error: unknown) {
    if (error instanceof PlatformCoreError) {
      return { kind: "platform_core_error", error };
    }
    return { kind: "raw", error };
  }
}

function assertNoRawThrow(outcome: Outcome, label: string): asserts outcome is
  | { kind: "result"; value: ValidationResult }
  | { kind: "platform_core_error"; error: PlatformCoreError } {
  if (outcome.kind === "raw") {
    const name = outcome.error instanceof Error ? outcome.error.name : typeof outcome.error;
    const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
    assert.fail(
      `${label}: expected ValidationResult or PlatformCoreError, got raw ${name}: ${message}`,
    );
  }
}

function pluginWithCompositeMeta(): WorkspacePlugin {
  return {
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
  };
}

describe("mutation attack — validateCanonicalDocument path", () => {
  it("orphan nested path (unregistered segment) returns ValidationResult, not TypeError", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: {
          title: "My tour",
          shadow: { fieldId: "nonexistent.widget.id", payload: "malicious" },
        },
        details: { summary: "Summary text" },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "orphan nested path");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, true);
  });

  it("unlisted root key maps ingress failure to ValidationResult (CANONICAL_ROOT_UNKNOWN)", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const document = documentWithRuntimePoison({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: { summary: "Summary text" },
        phantomRoot: { stolen: true },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "phantom root");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, false);
    assert.equal(outcome.value.violations[0]?.code, "CANONICAL_ROOT_UNKNOWN");
  });

  it("composite payload with invalid nested fieldId reference yields structured violation", () => {
    const engine = loadPlatformWizard(pluginWithCompositeMeta());
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: {
          summary: "Summary text",
          meta: {
            widgetFieldId: "registry.does.not.exist",
            nested: { depth: 1 },
          },
        },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "composite widget fieldId");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, true);
  });

  it("composite path set to array reports structured ingress/validation failure, not TypeError", () => {
    const engine = loadPlatformWizard(pluginWithCompositeMeta());
    const document = documentWithRuntimePoison({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: {
          summary: "Summary text",
          meta: ["not", "a", "plain", "object"],
        },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "composite array");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, false);
    assert.ok(
      outcome.value.violations.some(
        (v) =>
          v.code === "CANONICAL_TYPE_MISMATCH" ||
          v.code === "SANITIZE_ARRAY_NOT_ALLOWED" ||
          v.code === "CANONICAL_INVALID_DATA",
      ),
      `expected structured violation, got ${JSON.stringify(outcome.value.violations)}`,
    );
  });

  it("required path absent while homoglyph path populated reports UNKNOWN_CANONICAL_PATH", () => {
    const engine = loadPlatformWizard(createTestStarterPlugin());
    const homoglyphKey = `t\u0456tle`;
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { [homoglyphKey]: "looks-like-title" },
        details: { summary: "Summary text" },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "homoglyph-only basics");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, false);
    assert.equal(outcome.value.violations[0]?.code, "UNKNOWN_CANONICAL_PATH");
    assert.equal(outcome.value.violations[0]?.fieldId, "basics.title");
  });

  it("forbidden __proto__ segment under registered composite is structured, not TypeError", () => {
    const engine = loadPlatformWizard(pluginWithCompositeMeta());
    const document = documentWithRuntimePoison({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: {
          summary: "Summary text",
          meta: { __proto__: { polluted: true }, note: "ok" },
        },
      },
    });
    const outcome = runValidateCanonical(engine, document);
    assertNoRawThrow(outcome, "__proto__ under composite");
    assert.equal(outcome.kind, "result");
    assert.equal(outcome.value.ok, false);
    assert.ok(
      outcome.value.violations.some(
        (v) =>
          v.code === "UNKNOWN_CANONICAL_PATH" ||
          v.code === "CANONICAL_TYPE_MISMATCH" ||
          v.code === "CANONICAL_FORBIDDEN_KEY" ||
          v.code === "SANITIZE_NON_PLAIN_PROTOTYPE" ||
          v.code === "CANONICAL_INVALID_DATA",
      ),
      `expected structured violation, got ${JSON.stringify(outcome.value.violations)}`,
    );
  });
});
