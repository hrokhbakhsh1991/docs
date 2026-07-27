/**
 * Thin Shell Phase 3e / Wave 5a — lock facade + ownership exits from Phases 3b–3d.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");
const WIZARD = join(WEB_ROOT, "src/wizard");
const BOOTSTRAP = join(WEB_ROOT, "src/bootstrap");
const FEATURES = join(WEB_ROOT, "src/features");

describe("thin-shell-facade-exit — Phase 3b–3d locks", () => {
  it("3b–3d pure re-export facades are absent", () => {
    assert.equal(existsSync(join(WIZARD, "host-adapter-runtime.ts")), false);
    assert.equal(existsSync(join(WIZARD, "draft-shell-runtime.ts")), false);
    assert.equal(existsSync(join(WIZARD, "wizard-chrome-runtime.ts")), false);
  });

  it("4p trunk product loaders call getWorkspacePlugin only (no branded getters)", () => {
    const loaders = readFileSync(join(BOOTSTRAP, "workspace-plugin-loaders.generated.ts"), "utf8");
    assert.match(loaders, /mod\.getWorkspacePlugin\(\)/);
    assert.doesNotMatch(loaders, /getUrbanWorkspacePlugin|getStarterWorkspacePlugin|getGuestClubWorkspacePlugin/);
    assert.doesNotMatch(loaders, /getBookingWs2WorkspacePlugin|getFinanceWs5WorkspacePlugin/);
    assert.doesNotMatch(loaders, /getDenaliWorkspacePlugin|getAcmeWorkspacePlugin/);
  });

  it("4m plugin loaders call getWorkspacePlugin (no getDenali in generated loaders)", () => {
    const loaders = readFileSync(join(BOOTSTRAP, "workspace-plugin-loaders.generated.ts"), "utf8");
    assert.match(loaders, /mod\.getWorkspacePlugin\(\)/);
    assert.doesNotMatch(loaders, /getDenali/);
    assert.doesNotMatch(loaders, /ensureDenali/);
  });

  it("4au template-preset binder deleted; capability owns buildFullTemplatePreset", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-template-preset-bindings.generated.ts")),
      false
    );
    const helper = readFileSync(join(FEATURES, "settings/wizard-template-preset.ts"), "utf8");
    assert.match(helper, /resolveTemplatePresetCapability/);
    assert.match(helper, /export async function loadFullWizardTemplatePreset/);
    assert.doesNotMatch(helper, /workspace-wizard-template-preset-bindings/);
  });

  it("4k/4ai flat-edit form binder deleted; registry owns testIds resolver", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-flat-edit-form-bindings.generated.ts")),
      false
    );
    const formRegistry = readFileSync(join(WIZARD, "wizard-flat-edit-form-registry.ts"), "utf8");
    assert.match(formRegistry, /export function resolveOperatorFlatEditTestIds/);
    assert.match(formRegistry, /peekWizardFlatEditFormSurface/);
    assert.doesNotMatch(formRegistry, /workspace-wizard-flat-edit-form-bindings/);
    assert.doesNotMatch(formRegistry, /DenaliTourWizardDraft/);
    assert.doesNotMatch(formRegistry, /resolveDenaliFlatEditTestIds/);
  });

  it("4j/4ah–4ak create + flat-edit UI binders deleted; registries own Operator symbols", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-create-chrome-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-flat-edit-chrome-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-flat-edit-page-bindings.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-create-view-bindings.generated.ts")),
      false
    );
    const createRegistry = readFileSync(join(WIZARD, "wizard-create-chrome-registry.ts"), "utf8");
    assert.match(createRegistry, /export function useOperatorCreateTourWizardCore/);
    assert.match(createRegistry, /export type OperatorCreateTourWizardScreen/);
    assert.doesNotMatch(createRegistry, /workspace-wizard-create-chrome-bindings/);
    const flatRegistry = readFileSync(join(WIZARD, "wizard-flat-edit-chrome-registry.ts"), "utf8");
    assert.match(flatRegistry, /export function useOperatorFlatEditPageCore/);
    assert.match(flatRegistry, /export async function loadOperatorSubmitCatalogIds/);
    assert.doesNotMatch(flatRegistry, /workspace-wizard-flat-edit-chrome-bindings/);
  });

  it("4i/4aq/4bh wizard i18n allowlist only; no product useTranslations fan-out; label binder deleted", () => {
    assert.equal(existsSync(join(BOOTSTRAP, "wizard-label-bindings.generated.ts")), false);
    const i18n = readFileSync(join(BOOTSTRAP, "wizard-i18n-translator-hooks.generated.ts"), "utf8");
    assert.match(i18n, /export type WorkspaceWizardI18nNamespace/);
    assert.match(i18n, /export function isWorkspaceWizardI18nNamespace/);
    assert.match(i18n, /export function listWorkspaceWizardI18nNamespaces/);
    assert.doesNotMatch(i18n, /export const WORKSPACE_WIZARD_I18N_NAMESPACES/);
    assert.doesNotMatch(i18n, /useTranslations/);
    assert.doesNotMatch(i18n, /useGeneratedWorkspaceWizardTranslators/);
    assert.doesNotMatch(i18n, /"use client"/);
    const translator = readFileSync(join(WIZARD, "use-workspace-wizard-translator.ts"), "utf8");
    assert.match(translator, /isWorkspaceWizardI18nNamespace/);
    assert.match(translator, /useTranslations\(activeNamespace\)/);
    assert.doesNotMatch(translator, /WORKSPACE_WIZARD_I18N_NAMESPACES/);
    assert.doesNotMatch(translator, /useGeneratedWorkspaceWizardTranslators/);
    assert.doesNotMatch(translator, /wizard-label-bindings/);
    assert.doesNotMatch(translator, /useTranslations\(["']denali["']\)/);
    assert.doesNotMatch(translator, /useTranslations\(["']urban["']\)/);
    const resolveLabel = readFileSync(
      join(WEB_ROOT, "src/i18n/resolve-workspace-label.ts"),
      "utf8"
    );
    assert.match(resolveLabel, /listWorkspaceWizardI18nNamespaces/);
    assert.doesNotMatch(resolveLabel, /WORKSPACE_WIZARD_I18N_NAMESPACES/);
    assert.doesNotMatch(resolveLabel, /wizard-label-bindings/);
    const warm = readFileSync(join(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    assert.match(warm, /ensureWizardHostReady/);
    assert.doesNotMatch(warm, /wizard-label-bindings/);
  });

  it("4h admin theme registry map is private behind resolve/list helpers", () => {
    const theme = readFileSync(join(BOOTSTRAP, "workspace-theme-stylesheets.generated.ts"), "utf8");
    assert.match(theme, /export function resolveAdminThemeStylesheets/);
    assert.match(theme, /export function listAdminThemeRegistryPluginIds/);
    assert.match(theme, /export async function importAdminThemeForPlugin/);
    assert.doesNotMatch(theme, /export const WORKSPACE_ADMIN_THEME_REGISTRY/);
    const client = readFileSync(
      join(WEB_ROOT, "src/bootstrap/resolve-bootstrap-workspace-plugin.client.ts"),
      "utf8"
    );
    assert.match(client, /resolveAdminThemeStylesheets/);
    assert.doesNotMatch(client, /WORKSPACE_ADMIN_THEME_REGISTRY/);
  });

  it("4g/4an template-gate binder deleted; capability owns defaults + augment", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-template-gate-bindings.generated.ts")),
      false
    );
    const logic = readFileSync(join(WEB_ROOT, "src/tours/wizard-template-gate-logic.ts"), "utf8");
    const warm = readFileSync(join(WEB_ROOT, "src/wizard/warm-operator-wizard-shell.ts"), "utf8");
    assert.match(logic, /resolveTemplateGateCapability/);
    assert.doesNotMatch(logic, /workspace-wizard-template-gate-bindings/);
    assert.doesNotMatch(warm, /ensureWizardTemplateFieldOverlaysAugment/);
    assert.doesNotMatch(warm, /workspace-wizard-template-gate-bindings/);
  });

  it("4f wizard media route path maps are private behind lookup helpers", () => {
    const bff = readFileSync(join(BOOTSTRAP, "wizard-media-route-bindings.generated.ts"), "utf8");
    assert.match(bff, /export function lookupWizardMediaRouteBffPath/);
    assert.doesNotMatch(bff, /export const WIZARD_MEDIA_ROUTE_BFF_PATHS/);
    const backend = readFileSync(
      join(BOOTSTRAP, "wizard-media-backend-route-bindings.generated.ts"),
      "utf8"
    );
    assert.match(backend, /export function lookupWizardMediaRouteBackendPaths/);
    assert.doesNotMatch(backend, /export const WIZARD_MEDIA_ROUTE_BACKEND_PATHS/);
  });

  it("4e operator-shell nav uses capability registry; brand-fallback map stays private", () => {
    assert.equal(existsSync(join(BOOTSTRAP, "operator-shell-nav-bindings.generated.ts")), false);
    const navRegistry = readFileSync(
      join(WEB_ROOT, "src/shell/operator-shell-nav-registry.ts"),
      "utf8"
    );
    assert.match(navRegistry, /export function resolveOperatorShellNavLinks/);
    assert.match(navRegistry, /resolveOperatorShellNavCapability/);
    assert.doesNotMatch(navRegistry, /WORKSPACE_OPERATOR_SHELL_NAV/);

    assert.equal(existsSync(join(BOOTSTRAP, "wizard-create-bindings.generated.ts")), false);
    const createRegistry = readFileSync(
      join(WEB_ROOT, "src/workspace/wizard-create-registry.ts"),
      "utf8"
    );
    assert.match(createRegistry, /export function resolveWizardCustomBrandFallbackMark/);
    assert.match(createRegistry, /resolveWizardCreateCapability/);
    assert.doesNotMatch(createRegistry, /WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS/);

    const fallback = readFileSync(
      join(WEB_ROOT, "src/admin/shell/tenant-brand-fallback-mark.tsx"),
      "utf8"
    );
    assert.match(fallback, /resolveWizardCustomBrandFallbackMark/);
    assert.doesNotMatch(fallback, /WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS/);
    assert.doesNotMatch(fallback, /wizard-create-bindings/);
  });

  it("4d booking-ops + finance-ops binders deleted (capability owns resolve)", () => {
    assert.equal(existsSync(join(BOOTSTRAP, "workspace-booking-ops-bindings.generated.ts")), false);
    assert.equal(existsSync(join(BOOTSTRAP, "workspace-finance-ops-bindings.generated.ts")), false);

    const bookingPanels = readFileSync(
      join(WEB_ROOT, "src/features/bookings/booking-ops-panels.ts"),
      "utf8"
    );
    assert.match(bookingPanels, /resolveBookingOpsCapability/);
    assert.match(bookingPanels, /resolveBookingOpsCapabilityForHub/);
    assert.doesNotMatch(bookingPanels, /workspace-booking-ops-bindings/);

    const panels = readFileSync(join(WEB_ROOT, "src/finance/finance-ops-panels.ts"), "utf8");
    assert.match(panels, /resolveFinanceOpsCapability/);
    assert.match(panels, /resolveFinanceOpsCapabilityForHub/);
    assert.doesNotMatch(panels, /workspace-finance-ops-bindings/);
  });

  it("4c finance-nav binder deleted; capability registry owns isFinanceNavPlugin", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-finance-nav-bindings.generated.ts")),
      false
    );
    const registry = readFileSync(join(WEB_ROOT, "src/finance/finance-nav-registry.ts"), "utf8");
    assert.match(registry, /export function isFinanceNavPlugin/);
    assert.match(registry, /resolveFinanceNavCapability/);
    assert.doesNotMatch(registry, /FINANCE_NAV_PLUGIN_IDS/);
    const enablement = readFileSync(
      join(WEB_ROOT, "src/finance/finance-nav-enablement.ts"),
      "utf8"
    );
    assert.match(enablement, /isFinanceNavPlugin/);
    assert.match(enablement, /finance-nav-registry/);
    assert.doesNotMatch(enablement, /workspace-finance-nav-bindings/);
  });

  it("4b wizard-create binder deleted; registry owns extended-create predicate", () => {
    assert.equal(existsSync(join(BOOTSTRAP, "wizard-create-bindings.generated.ts")), false);
    const registry = readFileSync(
      join(WEB_ROOT, "src/workspace/wizard-create-registry.ts"),
      "utf8"
    );
    assert.match(registry, /export function isWizardExtendedCreatePlugin/);
    assert.match(registry, /ensureWizardCreate/);
    assert.match(registry, /seedWizardCreate/);
    assert.doesNotMatch(registry, /WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS/);
    const helper = readFileSync(
      join(WEB_ROOT, "src/workspace/is-extended-operator-workspace.ts"),
      "utf8"
    );
    assert.match(helper, /isWizardExtendedCreatePlugin/);
    assert.match(helper, /wizard-create-registry/);
    assert.doesNotMatch(helper, /wizard-create-bindings/);
    assert.doesNotMatch(helper, /WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS/);
  });

  it("4a empty wizard composite registry shell binder is absent", () => {
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-composite-registry-bindings.generated.ts")),
      false
    );
  });

  it("3c/4av settings-hub fallback binder deleted; capability owns recovery policy", () => {
    assert.equal(
      existsSync(join(FEATURES, "settings/denali-required-settings-modules.generated.ts")),
      false
    );
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-settings-hub-fallback-bindings.generated.ts")),
      false
    );
    const registry = readFileSync(
      join(FEATURES, "settings/settings-hub-fallback-registry.ts"),
      "utf8"
    );
    assert.match(registry, /resolveSettingsHubFallbackCapability/);
    assert.match(registry, /ensureSettingsHubFallbackPolicy/);
    assert.doesNotMatch(registry, /DENALI_BACKEND_REQUIRED_MODULE_IDS/);
    assert.doesNotMatch(registry, /workspace-settings-hub-fallback-bindings/);
  });

  it("3d/4al draft shell is capability-only (binder deleted)", () => {
    const draftShell = readFileSync(join(WIZARD, "wizard-draft-shell.ts"), "utf8");
    assert.match(draftShell, /resolveDraftShellCapability/);
    assert.match(draftShell, /createWizardDraftSessionIdForPlugin/);
    assert.doesNotMatch(draftShell, /workspace-wizard-draft-shell-bindings\.generated/);
    assert.doesNotMatch(draftShell, /from\s+["'][^"']*draft-shell-runtime["']/);
    assert.doesNotMatch(draftShell, /getWorkspacePluginFromDraftShell/);
    assert.equal(
      existsSync(join(BOOTSTRAP, "workspace-wizard-draft-shell-bindings.generated.ts")),
      false
    );

    const create = readFileSync(join(WIZARD, "use-create-tour-wizard.ts"), "utf8");
    assert.match(create, /wizard-create-chrome-registry/);
    assert.doesNotMatch(create, /workspace-wizard-create-chrome-bindings\.generated/);
    assert.doesNotMatch(create, /from\s+["'][^"']*wizard-chrome-runtime["']/);
    assert.doesNotMatch(create, /prepareOperatorDraftEnvelope/);
    assert.doesNotMatch(create, /hydrateOperatorDraftEnvelope/);

    const flatEdit = readFileSync(join(WIZARD, "use-flat-edit-page.ts"), "utf8");
    assert.match(flatEdit, /wizard-flat-edit-chrome-registry/);
    assert.match(flatEdit, /wizard-draft-shell/);
    assert.doesNotMatch(flatEdit, /from\s+["'][^"']*(?:draft-shell-runtime|wizard-chrome-runtime)["']/);
    assert.doesNotMatch(flatEdit, /createOperatorDraftSchemaGate/);
  });

  it("host adapters resolve via registry surface key (Phase 2c–3b)", () => {
    const registry = readFileSync(join(WIZARD, "wizard-host-adapter-registry.ts"), "utf8");
    assert.match(
      registry,
      /WIZARD_HOST_ADAPTER_SURFACE_KEY|app-cloud\.wizardHostAdapterSurface/
    );
  });
});
