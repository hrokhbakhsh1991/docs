/**
 * Phase 14.4 — wizardHost extension TCK (denali, urban, starter)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";

type PluginLoader = () => {
  id: string;
  wizardHost?: {
    usesStepValidation?: boolean;
    validationSurfaceId?: string;
    wizardMessageNamespace?: string;
    validateDraftSync?: (...args: unknown[]) => unknown;
    mergeDraftEnvelope?: (...args: unknown[]) => unknown;
    normalizeWizardTemplateGate?: (...args: unknown[]) => unknown;
    prepareSubmitPayload?: (...args: unknown[]) => unknown;
  };
  tourClone?: unknown;
};

const PLUGINS: readonly { readonly id: string; readonly load: PluginLoader }[] = [
  { id: "denali", load: getDenaliWorkspacePlugin },
  { id: "urban", load: getUrbanWorkspacePlugin },
  { id: "starter", load: getStarterWorkspacePlugin },
];

describe("wizard-host-tck.spec.ts (P14-4-T04)", () => {
  for (const { id, load } of PLUGINS) {
    it(`P14-4-04-${id} exposes wizardHost with step validation`, () => {
      const plugin = load();
      assert.equal(plugin.id, id);
      assert.ok(plugin.wizardHost);
      assert.equal(plugin.wizardHost?.usesStepValidation, true);
      assert.equal(typeof plugin.wizardHost?.validateDraftSync, "function");
    });
  }

  it("P14-4-04-denali exposes mergeDraftEnvelope, template gate, and tourClone", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(typeof plugin.wizardHost?.mergeDraftEnvelope, "function");
    assert.equal(typeof plugin.wizardHost?.normalizeWizardTemplateGate, "function");
    assert.equal(plugin.wizardHost?.compositeSurfaceId, "denali");
    assert.equal(plugin.wizardHost?.reviewSurfaceId, "denali");
    assert.equal(plugin.wizardHost?.fieldLabelSurfaceId, "denali");
    assert.ok(plugin.tourClone);
  });

  it("P14-4-04-starter exposes prepareSubmitPayload", () => {
    const plugin = getStarterWorkspacePlugin();
    assert.equal(typeof plugin.wizardHost?.prepareSubmitPayload, "function");
    assert.equal(plugin.wizardHost?.validationSurfaceId, "platform");
  });

  it("P14-4-04-urban pins city dimensions and urban i18n namespace", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.wizardHost?.wizardMessageNamespace, "urban");
    assert.deepEqual(plugin.wizardHost?.resolveMatrixDimensionsFromDraft?.({}, null), {
      tourType: "city",
    });
    assert.equal(plugin.tourClone, undefined);
  });

  it("P15-W-B7-denali mergeDraftEnvelope overlays local program onto server roots", () => {
    const plugin = getDenaliWorkspacePlugin();
    const merge = plugin.wizardHost?.mergeDraftEnvelope;
    assert.equal(typeof merge, "function");

    const local = {
      form: { data: { program: { shortDescription: "Local" } } },
      meta: { currentStepIndex: 1 },
    };
    const server = {
      form: {
        data: { program: { shortDescription: "Server", longDescription: "Long" } },
      },
      meta: { currentStepIndex: 0 },
    };
    const merged = merge!(local, server) as typeof local;

    assert.deepEqual(merged.form.data.program, {
      shortDescription: "Local",
      longDescription: "Long",
    });
    assert.equal(merged.meta.currentStepIndex, 1);
  });

  it("P15-W-B7-urban validateDraftSync rejects incomplete tour draft", () => {
    const plugin = getUrbanWorkspacePlugin();
    const result = plugin.wizardHost?.validateDraftSync?.({
      plugin,
      draft: { data: { tour: { title: "" } } },
      rulesModule: null,
      tenantId: "urban-wizard-host-tck",
    });
    assert.ok(result);
    assert.equal(result.ok, false);
    assert.ok(
      result.violations.some((violation) => violation.fieldId === "tour.title"),
      JSON.stringify(result.violations)
    );
  });

  it("P15-W-B7-starter prepareSubmitPayload projects canonical document", () => {
    const plugin = getStarterWorkspacePlugin();
    const prepare = plugin.wizardHost?.prepareSubmitPayload;
    assert.equal(typeof prepare, "function");

    const payload = prepare!({
      plugin,
      draft: {
        data: {
          basics: { title: "Starter tour", featured: false },
          details: { summary: "Summary", status: "draft" },
        },
      },
      rulesModule: null,
      evalContext: { uiOptions: {} },
    }) as {
      schemaVersion: number;
      roots: readonly string[];
      data: Record<string, unknown>;
    };

    assert.equal(payload.schemaVersion, 1);
    assert.deepEqual(payload.roots, [...plugin.wizard.roots]);
    assert.equal((payload.data.basics as { title: string }).title, "Starter tour");
    assert.equal((payload.data.details as { status: string }).status, "draft");
  });
});
