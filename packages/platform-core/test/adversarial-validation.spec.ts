import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createCanonicalDocument,
  starterWorkspacePlugin,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { testRuleContext } from "../src/__fixtures__/rule-context.fixture";
import { PlatformCoreError } from "../src/errors/platform-core.error";
import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine";
import { RuleEngine } from "../src/engine/rule.engine";
import { assertCanonicalValueMatchesKind } from "../src/utils/canonical-value";
import { getCanonicalValue } from "../src/utils/canonical-path";

const HOMOGLYPH_I = "\u0456";
const HOMOGLYPH_TITLE_KEY = `t${HOMOGLYPH_I}tle`;

describe("adversarial validation — unicode homoglyphs", () => {
  it("getCanonicalValue does not alias homoglyph segments to ASCII registry paths", () => {
    const data = {
      basics: {
        title: "registered",
        [HOMOGLYPH_TITLE_KEY]: "homoglyph-payload",
      },
    };
    assert.equal(getCanonicalValue(data, "basics.title"), "registered");
    assert.equal(getCanonicalValue(data, `basics.${HOMOGLYPH_TITLE_KEY}`), "homoglyph-payload");
    assert.equal(getCanonicalValue(data, "basics.titile"), undefined);
  });

  it("validateCanonical reports UNKNOWN_CANONICAL_PATH when only homoglyph value is present", () => {
    const engine = PlatformWizardEngine.fromPlugin(starterWorkspacePlugin);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { [HOMOGLYPH_TITLE_KEY]: "looks-like-title" },
        details: { summary: "ok" },
      },
    });
    const result = engine.validateCanonical(document, testRuleContext({ variant: "default" }));
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "UNKNOWN_CANONICAL_PATH");
    assert.equal(result.violations[0]?.fieldId, "basics.title");
  });

  it("treats NFC and NFD dimension values as equivalent after normalization", () => {
    const nfc = "\u00e9";
    const nfd = "e\u0301";
    assert.notEqual(nfc, nfd);
    assert.equal(nfc.normalize("NFC"), nfd.normalize("NFC"));

    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      ruleSet: {
        version: 1,
        matrixDimensions: ["variant"],
        defaultCellId: "default",
        cells: [
          {
            cellId: "nfc-cell",
            dimensions: { variant: nfc },
            fieldOverrides: [{ fieldId: "basics.title", required: false, hidden: false }],
          },
          {
            cellId: "default",
            dimensions: { variant: "default" },
            fieldOverrides: [{ fieldId: "basics.title", required: true, hidden: false }],
          },
        ],
      },
    };

    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const ruleEngine = engine["ruleEngine"] as RuleEngine;
    const nfcScope = ruleEngine.createScope(
      testRuleContext({ variant: nfc }, { tenantId: "tenant_nfc" }),
    );
    const nfdScope = ruleEngine.createScope(
      testRuleContext({ variant: nfd }, { tenantId: "tenant_nfd" }),
    );

    assert.equal(nfcScope.resolveCellId(), "nfc-cell");
    assert.equal(nfdScope.resolveCellId(), "nfc-cell");
    assert.equal(
      ruleEngine.createScope(testRuleContext({ variant: nfc }, { tenantId: "tenant_shared" })),
      ruleEngine.createScope(testRuleContext({ variant: nfd }, { tenantId: "tenant_shared" })),
    );
  });
});

describe("adversarial validation — exotic BigInt in composite trees", () => {
  it("assertCanonicalValueMatchesKind rejects BigInt deep inside composite nodes", () => {
    assert.throws(
      () =>
        assertCanonicalValueMatchesKind(
          {
            layer: {
              nested: {
                poison: BigInt(9000),
              },
            },
          },
          "composite",
          "widget.body",
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlatformCoreError);
        assert.equal(error.code, "CANONICAL_TYPE_MISMATCH");
        return true;
      },
    );
  });

  it("validateCanonical rejects BigInt inside registered composite fields", () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
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
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const document = {
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: {
          summary: "Summary",
          meta: {
            flags: {
              count: BigInt(99),
            },
          },
        },
      },
    };

    const result = engine.validateCanonical(
      document as Parameters<PlatformWizardEngine["validateCanonical"]>[0],
      testRuleContext({ variant: "default" }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_INVALID_DATA");
    assert.match(result.violations[0]?.message ?? "", /BigInt/i);
  });

  it("hidden composite field with BigInt poison is rejected at document ingress", () => {
    const plugin: WorkspacePlugin = {
      ...starterWorkspacePlugin,
      fieldRegistry: {
        version: 1,
        fields: [
          ...starterWorkspacePlugin.fieldRegistry.fields,
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
        ...starterWorkspacePlugin.ruleSet,
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
    const engine = PlatformWizardEngine.fromPlugin(plugin);
    const document = {
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: "My tour" },
        details: {
          summary: "Summary",
          meta: { nested: { value: BigInt(7) } },
        },
      },
    };

    const result = engine.validateCanonical(
      document as Parameters<PlatformWizardEngine["validateCanonical"]>[0],
      testRuleContext({ variant: "default" }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.violations[0]?.code, "CANONICAL_INVALID_DATA");
    assert.match(result.violations[0]?.message ?? "", /BigInt/i);
  });
});
