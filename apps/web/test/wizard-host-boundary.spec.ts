/**
 * Phase 12 — generic wizard host must stay plugin-agnostic (WEB-12.1-01, WEB-12.1b-01).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const HOST_PATH = join(WEB_ROOT, "src/wizard/workspace-wizard-host.tsx");
const DENALI_CREATE_CORE = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/ui/chrome/use-create-tour-wizard-core.ts"
);
const DENALI_FLAT_EDIT_CORE = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/ui/chrome/use-flat-edit-page-core.ts"
);

describe("wizard-host-boundary.spec.ts — Phase 12 host decouple", () => {
  it("WEB-12.1-01 host has no direct Denali review/validation component imports", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.doesNotMatch(source, /from\s+["'].*denali\/denali-review-validation-summary["']/);
    assert.doesNotMatch(source, /DenaliReviewValidationSummary/);
    assert.doesNotMatch(source, /from\s+["'].*denali\/denali-review-step["']/);
    assert.doesNotMatch(source, /from\s+["']@\/i18n\/wizard-labels["']/);
  });

  it("WEB-12.1b-01 host has no pluginId === denali branches", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(source, /pluginId\s*!==\s*["']denali["']/);
  });

  it("WEB-12-HOST-03 host resolves validation UI via registry helper", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.match(source, /resolveWizardValidationSurface/);
    assert.match(source, /renderValidationSummary/);
  });

  it("WEB-12-HOST-04 host uses resolveInitialStepIndex hook instead of draft resume import", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.match(source, /resolveInitialStepIndex/);
    assert.doesNotMatch(source, /denali-wizard-resume-step/);
  });

  it("WEB-12-HOST-05 validation surface falls back to platform default", () => {
    const registry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-review-surface-registry.tsx"),
      "utf8"
    );
    assert.match(registry, /platformValidationSurface/);
    assert.match(registry, /resolveGeneratedReviewSurface/);
    assert.match(registry, /resolveWizardValidationSurface[\s\S]*platformValidationSurface/);
    assert.doesNotMatch(registry, /denaliWizardReviewSurface/);
  });

  it("WEB-13.6-01 wizard-field has no denali prefix fallback", () => {
    const source = readFileSync(join(import.meta.dirname, "../src/wizard/wizard-field.tsx"), "utf8");
    assert.doesNotMatch(source, /startsWith\(["']denali\./);
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.match(source, /resolveWizardEnumOptionLabel/);
    assert.match(source, /data-wizard-composite-loading/);
  });

  it("P14-0b-04b wizard template editor bindings are codegen-only", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/bootstrap/workspace-wizard-template-editor-bindings.generated.ts"),
      "utf8"
    );
    assert.match(source, /ensureWizardTemplateEditor/);
    assert.match(source, /resolveWizardTemplateEditor/);
    assert.match(source, /denaliWizardTemplateEditor/);
    assert.match(source, /await import\(/);
    assert.match(source, /@app-tour\/workspace-denali\/settings\/wizard-template-editor/);
  });

  it("P14-0b-04 wizard-template-client has no pluginId denali branches", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../app/(app)/settings/tour-wizard-template/wizard-template-client.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.match(source, /ensureWizardTemplateEditor/);
    assert.match(source, /WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS/);
  });

  it("P14-0b-06 translator hook uses codegen namespaces", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-workspace-wizard-translator.ts"),
      "utf8"
    );
    assert.match(source, /WORKSPACE_WIZARD_I18N_NAMESPACES/);
    assert.match(source, /useGeneratedWorkspaceWizardTranslators/);
  });

  it("P14-3-04 wizard-bridge-shell uses extended create binding", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/shell/wizard-bridge-shell.tsx"),
      "utf8"
    );
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
    assert.match(source, /WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS/);
  });

  it("P14-3-04b operator chrome uses extended create binding not denali fork", () => {
    const operatorBrand = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-brand.tsx"),
      "utf8"
    );
    const welcome = readFileSync(
      join(import.meta.dirname, "../src/admin/onboarding/operator-welcome-dialog.tsx"),
      "utf8"
    );
    const fallbackMark = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/tenant-brand-fallback-mark.tsx"),
      "utf8"
    );
    assert.doesNotMatch(operatorBrand, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(welcome, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(fallbackMark, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(fallbackMark, /DenaliLogoMark|denali-logo-mark|fallbackMark\s*===\s*["']denali["']/);
    assert.match(fallbackMark, /WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS/);
    assert.match(fallbackMark, /data-tenant-brand-initial/);
  });

  it("P14-0b-06b resolve-workspace-label uses codegen namespaces", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/i18n/resolve-workspace-label.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
    assert.match(source, /WORKSPACE_WIZARD_I18N_NAMESPACES/);
  });

  it("P14-0b-08 wizard-template-gate spec has no denali invariant imports", () => {
    const source = readFileSync(
      join(import.meta.dirname, "wizard-template-gate.spec.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /@app-tour\/workspace-denali\/wizard\/template-invariants/);
    assert.match(source, /normalizeWizardTemplateGate/);
  });

  it("P14-0b-06c load-messages uses codegen workspace wizard imports", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/i18n/load-messages.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.match(source, /loadWorkspaceWizardMessagesForLocale/);
  });

  it("P14-3-04c finance nav uses workspaceFinance binding; users/welcome keep extended chrome", () => {
    const finance = readFileSync(
      join(import.meta.dirname, "../src/finance/finance-nav-enablement.ts"),
      "utf8"
    );
    const users = readFileSync(
      join(import.meta.dirname, "../src/features/users/users-nav-access.ts"),
      "utf8"
    );
    const welcome = readFileSync(
      join(import.meta.dirname, "../src/admin/onboarding/resolve-operator-welcome.ts"),
      "utf8"
    );
    assert.match(finance, /workspace-finance-nav-bindings/);
    assert.doesNotMatch(finance, /isExtendedOperatorWorkspace/);
    assert.doesNotMatch(finance, /wizard-create-bindings/);
    assert.doesNotMatch(users, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(welcome, /@app-tour\/workspace-denali/);
    assert.match(users, /isExtendedOperatorWorkspace/);
    assert.match(welcome, /isExtendedOperatorWorkspace/);
  });

  it("P14-0b-05 template field labels use neutral canonical path formatter", () => {
    const labels = readFileSync(
      join(import.meta.dirname, "../src/tours/wizard-template-field-labels.ts"),
      "utf8"
    );
    const registry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-label-surface-registry.ts"),
      "utf8"
    );
    assert.doesNotMatch(labels, /@\/i18n\/(?:denali-)?wizard-labels/);
    assert.match(labels, /format-canonical-path-label/);
    assert.doesNotMatch(registry, /@\/i18n\/(?:denali-)?wizard-labels/);
  });

  it("P14-1-08 clone remint BFF routes share proxy handler", () => {
    const neutral = readFileSync(
      join(import.meta.dirname, "../app/api/wizard-clone-remint/route.ts"),
      "utf8"
    );
    const legacy = readFileSync(
      join(import.meta.dirname, "../app/api/tours/clone-photo-remint/route.ts"),
      "utf8"
    );
    assert.match(neutral, /proxyWizardCloneRemintPost/);
    assert.match(legacy, /proxyWizardCloneRemintPost/);
  });

  it("P0-T-151 denali package UI surfaces and chrome resolve under workspaces/denali", () => {
    assert.ok(existsSync(DENALI_CREATE_CORE));
    assert.ok(existsSync(DENALI_FLAT_EDIT_CORE));
    assert.ok(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/denali/src/ui/surfaces/composite-surface.tsx")
      )
    );
    assert.ok(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/denali/src/ui/chrome/denali-create-tour-wizard-view.tsx")
      )
    );
  });

  it("P15-W-B2 denali create wires resolveDenaliDraftMerge via orchestration hook", () => {
    const createTour = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client.tsx"),
      "utf8"
    );
    const createReady = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    assert.match(createTour, /OperatorCreateTourWizardClientReady/);
    assert.match(createReady, /useOperatorCreateTourWizard/);
    assert.match(hook, /resolveOperatorDraftMerge/);
    assert.doesNotMatch(hook, /mergeDenaliWizardDraftEnvelope/);
  });

  it("P15-W-B2 draft merge barrel replaced by types + mode-only resolver", () => {
    const mergeResolver = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/draft/resolve-denali-draft-merge.ts"),
      "utf8"
    );
    const draftTypes = readFileSync(
      join(import.meta.dirname, "../src/draft/tour-wizard-draft-envelope.ts"),
      "utf8"
    );
    const flatEditHook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-flat-edit-page.ts"),
      "utf8"
    );
    assert.match(draftTypes, /NewTourWizardDraftEnvelope/);
    assert.match(draftTypes, /WorkspaceWizardDraftEnvelope/);
    assert.match(mergeResolver, /resolveDenaliDraftMerge\(/);
    assert.doesNotMatch(mergeResolver, /denali-wizard-draft-merge/);
    assert.match(flatEditHook, /resolveOperatorDraftMerge\(resolveDraftUnificationV3Mode\(\)\)/);
  });

  it("P15-W-B1e denali create stays slim and delegates B1a hooks to orchestration", () => {
    const createTour = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client.tsx"),
      "utf8"
    );
    const createReady = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client-ready.tsx"),
      "utf8"
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    assert.ok(createTour.split("\n").length < 150);
    assert.match(createTour, /warmOperatorWizardShell/);
    assert.match(createTour, /OperatorCreateTourWizardClientReady/);
    assert.match(createReady, /resolveWizardCreateViewSurface/);
    assert.match(createReady, /CreateTourWizardView/);
    assert.match(createReady, /CreateTourWizardHeader/);
    assert.doesNotMatch(createTour, /useWorkspaceDraft/);
    assert.doesNotMatch(createReady, /useWorkspaceDraft/);
    assert.match(hook, /useWizardTemplateGate/);
    assert.match(hook, /useWizardCreateSeedPrefill/);
    assert.match(hook, /hydrateCreateTourFromClone/);
  });

  it("P15-W-B1d denali create submit flows through extracted payload helper", () => {
    const hook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    const createCore = readFileSync(DENALI_CREATE_CORE, "utf8");
    const submitLogic = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/chrome/create-submit-logic.ts"),
      "utf8"
    );
    const payload = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/chrome/tour-create-payload.ts"),
      "utf8"
    );
    assert.match(hook, /useOperatorCreateTourWizardCore/);
    assert.match(createCore, /runDenaliCreateTourSubmit/);
    assert.match(submitLogic, /submitDenaliCreateTour/);
    assert.match(payload, /loadDenaliSubmitCatalogIds/);
    assert.match(payload, /submitDenaliCreateTourViaWizardHostWithCatalogLoader/);
    assert.match(payload, /denali-wizard-submit-payload/);
    assert.doesNotMatch(payload, /function prepareDenaliTourCreatePayload/);
    assert.doesNotMatch(payload, /wizardHost\?\.prepareSubmitPayload/);
    assert.match(submitLogic, /validateDenaliCreateTourSubmitSync/);
    assert.doesNotMatch(submitLogic, /validateDenaliPublishTransitionSync/);
    assert.doesNotMatch(hook, /submitDenaliCreateTour/);
    assert.doesNotMatch(hook, /runDenaliCreateTourSubmit/);
  });

  it("P15-W-B1c create and flat-edit share generalized rule-sync hook", () => {
    const createHook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    const createCore = readFileSync(DENALI_CREATE_CORE, "utf8");
    const flatEdit = readFileSync(
      join(import.meta.dirname, "../app/(app)/tours/[id]/edit/flat-edit-page-client.tsx"),
      "utf8"
    );
    const flatEditHook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-flat-edit-page.ts"),
      "utf8"
    );
    const flatEditCore = readFileSync(DENALI_FLAT_EDIT_CORE, "utf8");
    const ruleSync = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/hooks/use-wizard-rule-sync.ts"),
      "utf8"
    );
    assert.match(createHook, /useOperatorCreateTourWizardCore/);
    assert.match(createCore, /useDenaliWizardRuleSync/);
    assert.match(createCore, /useDenaliWizardRules/);
    assert.match(flatEditHook, /useOperatorFlatEditPageCore/);
    assert.match(flatEdit, /useOperatorFlatEditPage/);
    assert.match(flatEditCore, /useDenaliWizardRuleSync/);
    assert.match(flatEditCore, /useDenaliWizardRules/);
    assert.doesNotMatch(flatEdit, /useDenaliFlatEditRuleSync/);
    assert.match(ruleSync, /export function useDenaliWizardRuleSync/);
    assert.match(ruleSync, /export function useDenaliThemeCatalog/);
    assert.ok(
      !existsSync(join(import.meta.dirname, "../src/wizard/denali/use-denali-wizard-rule-sync.ts")),
      "rule-sync shell shim removed (PR-5c)"
    );
    assert.ok(
      !existsSync(join(import.meta.dirname, "../src/wizard/denali/use-denali-flat-edit-rule-sync.ts")),
      "flat-edit rule-sync shim removed (PR-5b)"
    );
  });

  it("P15-W-B1a platform and denali create share extracted gate/prefill hooks", () => {
    const platform = readFileSync(
      join(import.meta.dirname, "../src/wizard/workspace-create-tour-wizard-client.tsx"),
      "utf8"
    );
    const denaliHook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    for (const source of [platform, denaliHook]) {
      assert.match(source, /useWizardTemplateGate/);
      assert.match(source, /useWizardCreateSeedPrefill/);
      assert.match(source, /useWizardCreatePresetPrefill/);
      assert.doesNotMatch(source, /resolveWizardTemplateGateState\(/);
    }
    assert.doesNotMatch(platform, /denali-catalog-sanitize/);
    assert.doesNotMatch(platform, /getDenaliWorkspacePlugin/);
  });

  it("P15-W-B1b clone hydrate stays in helper and orchestration hook only", () => {
    const createTour = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client.tsx"),
      "utf8"
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    const hydrateLogic = readFileSync(
      join(import.meta.dirname, "../src/tours/tour-clone-hydrate-logic.ts"),
      "utf8"
    );
    assert.doesNotMatch(createTour, /hydrateCreateTourFromClone/);
    assert.doesNotMatch(createTour, /tour-clone-hydrate-logic/);
    assert.match(hook, /hydrateCreateTourFromClone/);
    assert.match(hydrateLogic, /export async function hydrateCreateTourFromClone/);
  });

  it("P15-W-B1e denali draft binding is thin web barrel over package draft", () => {
    const hook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    const binding = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-draft-shell.ts"),
      "utf8"
    );
    const draftRuntime = readFileSync(
      join(import.meta.dirname, "../src/wizard/draft-shell-runtime.ts"),
      "utf8"
    );
    const hostRuntime = readFileSync(
      join(import.meta.dirname, "../src/wizard/host-adapter-runtime.ts"),
      "utf8"
    );
    assert.match(hook, /wizard-draft-shell/);
    assert.match(hook, /host-adapter-runtime/);
    assert.match(hook, /createTourRemoteDraftIdentity/);
    assert.match(hook, /buildCreateTourDiscardRemoteDraftInput/);
    assert.match(binding, /draft-shell-runtime/);
    assert.match(binding, /tour-wizard-draft-envelope/);
    assert.match(binding, /resolveOperatorDraftMerge/);
    assert.match(draftRuntime, /workspace-wizard-draft-shell-bindings\.generated/);
    assert.match(hostRuntime, /workspace-host-adapters\.generated/);
    assert.doesNotMatch(binding, /denali-wizard-draft-merge/);
  });
});
