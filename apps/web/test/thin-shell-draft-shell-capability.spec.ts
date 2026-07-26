/**
 * Thin Shell Phase 4v — draftShell capability identity spike.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import {
  resolveDraftShellCapability,
  resolveTemplateGateCapability,
} from "@app-cloud/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-draft-shell-capability — Phase 4v", () => {
  it("TS-4V-01 denali publishes capabilities.draftShell identity slice", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.ok(draft);
    assert.equal(draft.createTourDraftKey, "denali-create");
    assert.equal(draft.operatorDraftNamespace, "operator.wizard");
    assert.match(draft.editTourDraftKey("t1"), /t1/);
    assert.equal(typeof draft.createWizardDraftSessionId(), "string");
  });

  it("TS-4V-02 create/flat-edit prefer createWizardDraftSessionIdForPlugin", () => {
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const flat = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(shell, /resolveDraftShellCapability/);
    assert.match(shell, /createWizardDraftSessionIdForPlugin/);
    assert.match(create, /createWizardDraftSessionIdForPlugin/);
    assert.match(flat, /createWizardDraftSessionIdForPlugin/);
    assert.doesNotMatch(flat, /createOperatorWizardDraftSessionId\(plugin\.id\)/);
  });

  it("TS-4W-01 denali draftShell exposes fresh-start + merge resolvers", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.equal(typeof draft?.isFreshStartEnvelope, "function");
    assert.equal(typeof draft?.resolveDraftMerge, "function");
    assert.equal(draft?.resolveDraftMerge?.("on"), undefined);
    assert.equal(typeof draft?.resolveDraftMerge?.("off"), "function");
  });

  it("TS-4W-02 create/flat-edit prefer draftShell merge/fresh-start helpers", () => {
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const flat = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    assert.match(create, /isFreshStartEnvelopeForPlugin/);
    assert.match(create, /resolveDraftMergeForPlugin/);
    assert.match(flat, /resolveDraftMergeForPlugin/);
    assert.doesNotMatch(create, /isOperatorFreshStartEnvelope\(/);
    assert.doesNotMatch(create, /resolveOperatorDraftMerge\(/);
    assert.doesNotMatch(flat, /resolveOperatorDraftMerge\(/);
  });

  it("TS-4X-01 create/flat-edit prefer draftShell remote draft identity", () => {
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const flat = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(shell, /resolveCreateTourDraftIdentityForPlugin/);
    assert.match(shell, /resolveEditTourDraftIdentityForPlugin/);
    assert.match(create, /resolveCreateTourDraftIdentityForPlugin/);
    assert.match(flat, /resolveEditTourDraftIdentityForPlugin/);
  });

  it("TS-4X-02 denali draftShell identity matches create/edit key conventions", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.ok(draft);
    assert.equal(draft.operatorDraftNamespace, "operator.wizard");
    assert.equal(draft.createTourDraftKey, "denali-create");
    assert.equal(draft.editTourDraftKey("abc"), "denali-edit:abc");
  });

  it("TS-4Y-01 denali draftShell publishes buildCreatePrefilledForm", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.equal(typeof draft?.buildCreatePrefilledForm, "function");
    const form = draft!.buildCreatePrefilledForm!({
      seedLabel: "Peak",
      fieldOverlays: new Map(),
    });
    assert.ok(form && typeof form === "object");
  });

  it("TS-4Y-02 create prefers buildCreatePrefilledFormForPlugin", () => {
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    assert.match(shell, /buildCreatePrefilledFormForPlugin/);
    assert.match(create, /buildCreatePrefilledFormForPlugin/);
    assert.doesNotMatch(create, /buildCreatePrefilledForm\(wizardPlugin\.id/);
  });

  it("TS-4Z-01 denali draftShell publishes createDraftSchemaGate", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.equal(typeof draft?.createDraftSchemaGate, "function");
    const gate = draft!.createDraftSchemaGate!(
      {
        canonicalToFormPathMap: {},
        buildDefaultForm: () => ({}),
        applyDenaliInvariantState: (form: Record<string, unknown>) => form,
      },
      { uiOptions: {}, ruleSet: "publish" }
    );
    assert.equal(typeof gate, "function");
  });

  it("TS-4Z-02 shell exposes createDraftSchemaGateForPlugin; create/flat re-export it", () => {
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    const flat = readFileSync(resolve(WEB_ROOT, "src/wizard/use-flat-edit-page.ts"), "utf8");
    assert.match(shell, /createDraftSchemaGateForPlugin/);
    assert.match(shell, /requireDraftShell\(plugin\)\.createDraftSchemaGate/);
    assert.match(create, /createDraftSchemaGateForPlugin/);
    assert.match(flat, /createDraftSchemaGateForPlugin/);
  });

  it("TS-4AA-01 denali draftShell publishes isDraftEssentiallyEmpty", () => {
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.equal(typeof draft?.isDraftEssentiallyEmpty, "function");
    assert.equal(draft!.isDraftEssentiallyEmpty!({ data: {} }), true);
  });

  it("TS-4AA-02 create prefers isDraftEssentiallyEmptyForPlugin", () => {
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    const create = readFileSync(resolve(WEB_ROOT, "src/wizard/use-create-tour-wizard.ts"), "utf8");
    assert.match(shell, /isDraftEssentiallyEmptyForPlugin/);
    assert.match(shell, /resolveDraftShellCapability\(plugin\)/);
    assert.match(create, /isDraftEssentiallyEmptyForPlugin/);
    assert.doesNotMatch(
      create,
      /isDraftEssentiallyEmpty,\s*\n\s*draftResumeEpoch/
    );
  });

  it("TS-4AL-01 draft-shell binder deleted; warm skips binder; helpers are capability-only", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-draft-shell-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);
    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const shell = readFileSync(resolve(WEB_ROOT, "src/wizard/wizard-draft-shell.ts"), "utf8");
    assert.doesNotMatch(warm, /ensureWizardDraftShellSurface/);
    assert.doesNotMatch(warm, /workspace-wizard-draft-shell-bindings/);
    assert.doesNotMatch(shell, /workspace-wizard-draft-shell-bindings/);
    assert.match(shell, /requireDraftShell/);
  });

  it("TS-4AM-01 draft-unification binder deleted; folded into draftShell", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-draft-unification-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);
    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const options = readFileSync(
      resolve(WEB_ROOT, "src/draft/draft-unification-v3-options.ts"),
      "utf8"
    );
    const plugin = getDenaliPlugin();
    const draft = resolveDraftShellCapability(plugin);
    assert.equal(typeof draft?.readDraftFieldValue, "function");
    assert.equal(typeof draft?.logTombstoneShadowMismatch, "function");
    assert.doesNotMatch(warm, /ensureWizardDraftUnificationSurface/);
    assert.doesNotMatch(warm, /workspace-wizard-draft-unification-bindings/);
    assert.match(options, /createOperatorDraftOnPushSuccess\(\s*plugin/);
    assert.match(options, /resolveDraftShellCapability/);
  });

  it("TS-4AN-01 template-gate binder deleted; capabilities.templateGate owns policy", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-wizard-template-gate-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);
    const warm = readFileSync(resolve(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    const logic = readFileSync(resolve(WEB_ROOT, "src/tours/wizard-template-gate-logic.ts"), "utf8");
    const plugin = getDenaliPlugin();
    const gate = resolveTemplateGateCapability(plugin);
    assert.ok(gate);
    assert.equal(gate.defaultPublishedStepId, "denali_basic");
    assert.equal(gate.preferTemplateDefaultsOnPrefill, true);
    assert.equal(typeof gate.augmentFieldOverlays, "function");
    assert.doesNotMatch(warm, /ensureWizardTemplateFieldOverlaysAugment/);
    assert.doesNotMatch(warm, /workspace-wizard-template-gate-bindings/);
    assert.match(logic, /resolveTemplateGateCapability/);
  });
});
