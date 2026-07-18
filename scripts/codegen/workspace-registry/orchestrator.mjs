// Phase G3 — generateAllOutputs, OUTPUT_PATHS, CLI (--check, --domain)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const { join } = path;

import {
  assertMemberPortalL4ReferenceWorkspaces,
  assertMemberPortalManifest,
  generateWorkspaceMemberPortalContracts,
  generateWorkspaceMemberPortalSurfaces,
  normalizeMemberPortalAvailability,
  resolveEffectiveMemberPortalConfig,
} from "./domains/member-portal.mjs";

import { REPO_ROOT } from "./constants.mjs";
import { discoverManifests } from "./manifest-loader.mjs";
import {
  assertManifestWebModules,
  assertNoDottedKeysInWizardJson,
  assertPackageWebModule,
  assertWizardI18nAssets,
} from "./validation.mjs";
import {
  generateApiRegistry,
  generateSdkBindings,
  generateWebLoaders,
} from "./domains/core-registry.mjs";
import {
  assertHttpRoutesManifest,
  generateWorkspaceHttpErrorMap,
  generateWorkspaceHttpHandlerLoaders,
  generateWorkspaceHttpRoutes,
} from "./domains/http-routes.mjs";
import {
  assertCatalogPresentationManifest,
  assertGuestCrossSurfaceNavManifest,
  assertGuestExtensionsManifest,
  assertGuestLandingManifest,
  assertGuestSeoManifest,
  extractCatalogPathsFromManifest,
  generateWorkspaceCatalogDetailSections,
  generateWorkspaceCatalogListFeatures,
  generateWorkspaceCatalogPaths,
  generateWorkspaceGuestConformance,
  generateWorkspaceProductionCertification,
  generateWorkspaceGuestCrossSurfaceNav,
  generateWorkspaceGuestLanding,
  generateWorkspaceGuestSeo,
  resolveGuestConformanceLevel,
  resolveProductionCertificationTier,
} from "./domains/guest-catalog.mjs";
import {
  assertDevBootstrapPluginTenantIds,
  generateWorkspaceDevPluginIds,
} from "./domains/dev.mjs";
import {
  generateDevBootstrapBindings,
  generateSettingsEnrichers,
} from "./domains/settings-api.mjs";
import { generateWorkspaceOperatorCapabilities } from "./domains/operator.mjs";
import { generateWorkspaceFinanceBindings, generateWorkspaceFinanceNavBindings } from "./domains/finance.mjs";
import { generateExposureHostBindings } from "./domains/exposure.mjs";
import { generateWorkspaceIntegrationCapabilities } from "./domains/integration.mjs";
import {
  generateCanonicalTourBindings,
  generateOutboxSideEffects,
  generateTourWriteBindings,
} from "./domains/tour-api.mjs";
import {
  assertMemberProfileManifest,
  generateWorkspaceMemberProfileCapabilities,
} from "./domains/member.mjs";
import {
  generateAdminThemeStylesheetLoader,
  generateGuestThemeStylesheetLoader,
  generateGuestThemeStylesheets,
  generateWorkspaceThemeStylesheets,
} from "./domains/theme.mjs";
import {
  assertCatalogRegistrationFlowManifest,
  assertCatalogRegistrationTransportInitializerManifest,
  generateWorkspaceIntakePluginBootstrap,
  generateWorkspaceRegistrationFlowPlugins,
  generateWorkspaceRegistrationTransportInitializers,
} from "./domains/registration.mjs";
import {
  generateMarketingCatalogBindings,
  generateOperatorUiComponentsBindings,
  generatePhotoUploadErrorsBindings,
  generateSettingsDestinationBindings,
  generateSettingsEquipmentUiBindings,
  generateSettingsHubFallbackBindings,
  generateTourActionSubmitBindings,
  generateTourListCategoryBindings,
  generateWizardCloneRemintBindings,
  generateWizardCompositeRegistryBindings,
  generateWizardCreateBindings,
  generateWizardCreateChromeBindings,
  generateWizardCreateViewBindings,
  generateWizardDraftShellBindings,
  generateWizardDraftUnificationBindings,
  generateWizardFlatEditChromeBindings,
  generateWizardFlatEditFormBindings,
  generateWizardFlatEditPageBindings,
  generateWizardI18nTranslatorHooks,
  generateWizardLabelBindings,
  generateWizardMediaBackendRouteBindings,
  generateWizardMediaBindings,
  generateWizardMediaRouteBindings,
  generateWizardRulesBindings,
  generateWizardSurfaceBindings,
  generateWizardTemplateEditorBindings,
  generateWizardTemplateGateBindings,
  generateWizardTemplatePresetBindings,
  generateWorkspaceWizardMessageLoads,
} from "./domains/wizard-admin.mjs";

/** @type {Record<string, readonly string[]>} */
export const DOMAIN_OUTPUT_KEYS = {
  "core-registry": ["sdk", "api", "web"],
  "tour-api": ["tourWrite", "canonicalTour", "outbox"],
  "wizard-admin": [
    "wizardMedia",
    "wizardMediaRoutes",
    "wizardMediaBackendRoutes",
    "wizardSurfaces",
    "wizardLabels",
    "wizardI18nTranslators",
    "workspaceWizardMessages",
    "wizardCloneRemint",
    "wizardCreate",
    "wizardTemplateEditorBindings",
    "marketingCatalogBindings",
    "settingsDestinationBindings",
    "settingsEquipmentUiBindings",
    "tourActionSubmitBindings",
    "photoUploadErrorsBindings",
    "tourListCategoryBindings",
    "operatorUiComponentsBindings",
    "wizardDraftUnificationBindings",
    "wizardRulesBindings",
    "wizardTemplateGateBindings",
    "wizardTemplatePresetBindings",
    "wizardDraftShellBindings",
    "wizardCreateChromeBindings",
    "wizardFlatEditChromeBindings",
    "wizardFlatEditFormBindings",
    "wizardFlatEditPageBindings",
    "wizardCreateViewBindings",
    "wizardCompositeRegistryBindings",
    "settingsHubFallbackBindings",
  ],
  theme: ["themeStylesheets", "guestThemeStylesheetsPortal", "guestThemeStylesheetsMarketing"],
  "guest-catalog": [
    "catalogPaths",
    "catalogListFeatures",
    "catalogDetailSections",
    "guestConformance",
    "productionCertification",
    "guestSeo",
    "guestLanding",
    "guestCrossSurfaceNav",
  ],
  registration: [
    "workspaceIntakePlugins",
    "registrationFlowPlugins",
    "registrationTransportInitializers",
  ],
  member: ["memberProfileCapabilities", "memberPortalContracts", "memberPortalSurfaces"],
  http: ["httpRoutes", "httpHandlerLoaders", "httpErrorMap"],
  "settings-api": ["settingsEnrichers", "devBootstrap"],
  dev: ["devPluginIds"],
  operator: ["operatorCapabilities"],
  finance: ["workspaceFinance", "workspaceFinanceNav"],
  exposure: ["exposureHost"],
};

export const OUTPUT_KEYS = Object.freeze([
  "sdk",
  "api",
  "web",
  "tourWrite",
  "canonicalTour",
  "wizardMedia",
  "wizardMediaRoutes",
  "wizardMediaBackendRoutes",
  "wizardSurfaces",
  "wizardLabels",
  "wizardI18nTranslators",
  "workspaceWizardMessages",
  "wizardCloneRemint",
  "wizardCreate",
  "themeStylesheets",
  "guestThemeStylesheetsPortal",
  "guestThemeStylesheetsMarketing",
  "workspaceIntakePlugins",
  "registrationFlowPlugins",
  "registrationTransportInitializers",
  "catalogPaths",
  "catalogListFeatures",
  "catalogDetailSections",
  "operatorCapabilities",
  "workspaceFinance",
  "workspaceFinanceNav",
  "wizardTemplateEditorBindings",
  "marketingCatalogBindings",
  "settingsDestinationBindings",
  "settingsEquipmentUiBindings",
  "tourActionSubmitBindings",
  "photoUploadErrorsBindings",
  "tourListCategoryBindings",
  "operatorUiComponentsBindings",
  "wizardDraftUnificationBindings",
  "wizardRulesBindings",
  "wizardTemplateGateBindings",
  "wizardTemplatePresetBindings",
  "wizardDraftShellBindings",
  "wizardCreateChromeBindings",
  "wizardFlatEditChromeBindings",
  "wizardFlatEditFormBindings",
  "wizardFlatEditPageBindings",
  "wizardCreateViewBindings",
  "wizardCompositeRegistryBindings",
  "settingsHubFallbackBindings",
  "devPluginIds",
  "memberProfileCapabilities",
  "memberPortalContracts",
  "memberPortalSurfaces",
  "guestCrossSurfaceNav",
  "guestConformance",
  "productionCertification",
  "guestSeo",
  "guestLanding",
  "outbox",
  "settingsEnrichers",
  "devBootstrap",
  "httpRoutes",
  "httpHandlerLoaders",
  "httpErrorMap",
]);

export function generateAllOutputs(manifests) {
  for (const manifest of manifests) {
    assertGuestExtensionsManifest(manifest);
    assertHttpRoutesManifest(manifest);
  }

  return {
    sdk: generateSdkBindings(manifests),
    api: generateApiRegistry(manifests),
    web: generateWebLoaders(manifests),
    tourWrite: generateTourWriteBindings(manifests),
    canonicalTour: generateCanonicalTourBindings(manifests),
    wizardMedia: generateWizardMediaBindings(manifests),
    wizardMediaRoutes: generateWizardMediaRouteBindings(manifests),
    wizardMediaBackendRoutes: generateWizardMediaBackendRouteBindings(manifests),
    wizardSurfaces: generateWizardSurfaceBindings(manifests),
    wizardLabels: generateWizardLabelBindings(manifests),
    wizardI18nTranslators: generateWizardI18nTranslatorHooks(manifests),
    workspaceWizardMessages: generateWorkspaceWizardMessageLoads(manifests),
    wizardCloneRemint: generateWizardCloneRemintBindings(manifests),
    wizardCreate: generateWizardCreateBindings(manifests),
    themeStylesheets: generateAdminThemeStylesheetLoader(manifests),
    guestThemeStylesheetsPortal: generateGuestThemeStylesheetLoader(manifests, "portal"),
    guestThemeStylesheetsMarketing: generateGuestThemeStylesheetLoader(manifests, "marketing"),
    workspaceIntakePlugins: generateWorkspaceIntakePluginBootstrap(manifests),
    registrationFlowPlugins: generateWorkspaceRegistrationFlowPlugins(manifests),
    registrationTransportInitializers: generateWorkspaceRegistrationTransportInitializers(manifests),
    catalogPaths: generateWorkspaceCatalogPaths(manifests),
    catalogListFeatures: generateWorkspaceCatalogListFeatures(manifests),
    catalogDetailSections: generateWorkspaceCatalogDetailSections(manifests),
    operatorCapabilities: generateWorkspaceOperatorCapabilities(manifests),
    workspaceFinance: generateWorkspaceFinanceBindings(manifests),
    workspaceFinanceNav: generateWorkspaceFinanceNavBindings(manifests),
    wizardTemplateEditorBindings: generateWizardTemplateEditorBindings(manifests),
    marketingCatalogBindings: generateMarketingCatalogBindings(manifests),
    settingsDestinationBindings: generateSettingsDestinationBindings(manifests),
    settingsEquipmentUiBindings: generateSettingsEquipmentUiBindings(manifests),
    tourActionSubmitBindings: generateTourActionSubmitBindings(manifests),
    photoUploadErrorsBindings: generatePhotoUploadErrorsBindings(manifests),
    tourListCategoryBindings: generateTourListCategoryBindings(manifests),
    operatorUiComponentsBindings: generateOperatorUiComponentsBindings(manifests),
    wizardDraftUnificationBindings: generateWizardDraftUnificationBindings(manifests),
    wizardRulesBindings: generateWizardRulesBindings(manifests),
    wizardTemplateGateBindings: generateWizardTemplateGateBindings(manifests),
    wizardTemplatePresetBindings: generateWizardTemplatePresetBindings(manifests),
    wizardDraftShellBindings: generateWizardDraftShellBindings(manifests),
    wizardCreateChromeBindings: generateWizardCreateChromeBindings(manifests),
    wizardFlatEditChromeBindings: generateWizardFlatEditChromeBindings(manifests),
    wizardFlatEditFormBindings: generateWizardFlatEditFormBindings(manifests),
    wizardFlatEditPageBindings: generateWizardFlatEditPageBindings(manifests),
    wizardCreateViewBindings: generateWizardCreateViewBindings(manifests),
    wizardCompositeRegistryBindings: generateWizardCompositeRegistryBindings(manifests),
    settingsHubFallbackBindings: generateSettingsHubFallbackBindings(manifests),
    devPluginIds: generateWorkspaceDevPluginIds(manifests),
    memberProfileCapabilities: generateWorkspaceMemberProfileCapabilities(manifests),
    memberPortalContracts: generateWorkspaceMemberPortalContracts(manifests),
    memberPortalSurfaces: generateWorkspaceMemberPortalSurfaces(manifests),
    guestCrossSurfaceNav: generateWorkspaceGuestCrossSurfaceNav(manifests),
    guestConformance: generateWorkspaceGuestConformance(manifests),
    productionCertification: generateWorkspaceProductionCertification(manifests),
    guestSeo: generateWorkspaceGuestSeo(manifests),
    guestLanding: generateWorkspaceGuestLanding(manifests),
    outbox: generateOutboxSideEffects(manifests),
    settingsEnrichers: generateSettingsEnrichers(manifests),
    devBootstrap: generateDevBootstrapBindings(manifests),
    httpRoutes: generateWorkspaceHttpRoutes(manifests),
    httpHandlerLoaders: generateWorkspaceHttpHandlerLoaders(manifests),
    httpErrorMap: generateWorkspaceHttpErrorMap(manifests),
  };
}

export const OUTPUT_PATHS = {
  sdk: join(REPO_ROOT, "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts"),
  api: join(REPO_ROOT, "apps/api/src/workspace/workspace-plugin-registry.generated.ts"),
  web: join(REPO_ROOT, "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts"),
  tourWrite: join(REPO_ROOT, "apps/api/src/tours/workspace-tour-write-bindings.generated.ts"),
  canonicalTour: join(
    REPO_ROOT,
    "apps/api/src/canonical/workspace-canonical-tour-bindings.generated.ts"
  ),
  wizardMedia: join(REPO_ROOT, "apps/api/src/tours/workspace-wizard-media-bindings.generated.ts"),
  wizardMediaRoutes: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/wizard-media-route-bindings.generated.ts"
  ),
  wizardMediaBackendRoutes: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/wizard-media-backend-route-bindings.generated.ts"
  ),
  wizardSurfaces: join(REPO_ROOT, "apps/web/src/bootstrap/wizard-surface-bindings.generated.ts"),
  wizardLabels: join(REPO_ROOT, "apps/web/src/bootstrap/wizard-label-bindings.generated.ts"),
  wizardI18nTranslators: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/wizard-i18n-translator-hooks.generated.ts"
  ),
  workspaceWizardMessages: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-message-loads.generated.ts"
  ),
  wizardCloneRemint: join(
    REPO_ROOT,
    "apps/api/src/tours/workspace-wizard-clone-remint-bindings.generated.ts"
  ),
  wizardCreate: join(REPO_ROOT, "apps/web/src/bootstrap/wizard-create-bindings.generated.ts"),
  themeStylesheets: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts"
  ),
  guestThemeStylesheetsPortal: join(
    REPO_ROOT,
    "apps/portal/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
  ),
  guestThemeStylesheetsMarketing: join(
    REPO_ROOT,
    "apps/marketing/src/bootstrap/workspace-guest-theme-stylesheets.generated.ts"
  ),
  workspaceIntakePlugins: join(
    REPO_ROOT,
    "packages/workspace-plugin-host/src/workspace-intake-plugins.generated.ts"
  ),
  registrationFlowPlugins: join(
    REPO_ROOT,
    "packages/workspace-plugin-host/src/workspace-registration-flow-plugins.generated.ts"
  ),
  registrationTransportInitializers: join(
    REPO_ROOT,
    "packages/workspace-plugin-host/src/workspace-registration-transport-initializers.generated.ts"
  ),
  catalogPaths: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-catalog-paths.generated.ts"
  ),
  catalogListFeatures: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-catalog-list-features.generated.ts"
  ),
  catalogDetailSections: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-catalog-detail-sections.generated.ts"
  ),
  operatorCapabilities: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/operator/workspace-operator-capabilities.generated.ts"
  ),
  workspaceFinance: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-bindings.generated.ts"
  ),
  workspaceFinanceNav: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-finance-nav-bindings.generated.ts"
  ),
  wizardTemplateEditorBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-template-editor-bindings.generated.ts"
  ),
  marketingCatalogBindings: join(
    REPO_ROOT,
    "apps/marketing/src/bootstrap/workspace-marketing-catalog-bindings.generated.ts"
  ),
  settingsDestinationBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-settings-destination-bindings.generated.ts"
  ),
  settingsEquipmentUiBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-settings-equipment-ui-bindings.generated.ts"
  ),
  tourActionSubmitBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-tour-action-submit-bindings.generated.ts"
  ),
  photoUploadErrorsBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-photo-upload-errors-bindings.generated.ts"
  ),
  tourListCategoryBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-tour-list-category-bindings.generated.ts"
  ),
  operatorUiComponentsBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-operator-ui-components-bindings.generated.ts"
  ),
  wizardDraftUnificationBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-draft-unification-bindings.generated.ts"
  ),
  wizardRulesBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-rules-bindings.generated.ts"
  ),
  wizardTemplateGateBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-template-gate-bindings.generated.ts"
  ),
  wizardTemplatePresetBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-template-preset-bindings.generated.ts"
  ),
  wizardDraftShellBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-draft-shell-bindings.generated.ts"
  ),
  wizardCreateChromeBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-create-chrome-bindings.generated.ts"
  ),
  wizardFlatEditChromeBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-flat-edit-chrome-bindings.generated.ts"
  ),
  wizardFlatEditFormBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-flat-edit-form-bindings.generated.ts"
  ),
  wizardFlatEditPageBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-flat-edit-page-bindings.generated.ts"
  ),
  wizardCreateViewBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-create-view-bindings.generated.ts"
  ),
  wizardCompositeRegistryBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-wizard-composite-registry-bindings.generated.ts"
  ),
  settingsHubFallbackBindings: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-settings-hub-fallback-bindings.generated.ts"
  ),
  devPluginIds: join(
    REPO_ROOT,
    "packages/guest-surface-host/src/workspace-dev-plugin-ids.generated.ts"
  ),
  memberProfileCapabilities: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/profile/workspace-member-profile-capabilities.generated.ts"
  ),
  memberPortalContracts: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/portal/workspace-member-portal-contracts.generated.ts"
  ),
  memberPortalSurfaces: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/portal/workspace-member-portal-surfaces.generated.ts"
  ),
  guestCrossSurfaceNav: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-guest-cross-surface-nav.generated.ts"
  ),
  guestConformance: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-guest-conformance.generated.ts"
  ),
  productionCertification: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-production-certification.generated.ts"
  ),
  guestSeo: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-guest-seo.generated.ts"
  ),
  guestLanding: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/catalog/workspace-guest-landing.generated.ts"
  ),
  outbox: join(REPO_ROOT, "apps/api/src/workspace/workspace-outbox-side-effects.generated.ts"),
  settingsEnrichers: join(
    REPO_ROOT,
    "apps/api/src/settings/workspace-settings-enrichers.generated.ts"
  ),
  devBootstrap: join(
    REPO_ROOT,
    "apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts"
  ),
  httpRoutes: join(REPO_ROOT, "apps/api/src/http/workspace-http-routes.generated.ts"),
  httpHandlerLoaders: join(
    REPO_ROOT,
    "apps/api/src/http/workspace-http-handler-loaders.generated.ts"
  ),
  httpErrorMap: join(
    REPO_ROOT,
    "apps/api/src/middleware/workspace-http-error-map.generated.ts"
  ),
};

function readOutputs() {
  return Object.fromEntries(
    Object.entries(OUTPUT_PATHS).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")])
  );
}

/** @param {string[]} argv */
function parseDomainId(argv) {
  for (const arg of argv) {
    if (arg.startsWith("--domain=")) {
      return arg.slice("--domain=".length);
    }
  }
  return null;
}

/** @param {string | null} domainId */
function resolveOutputKeys(domainId) {
  if (domainId === null) {
    return OUTPUT_KEYS;
  }
  const keys = DOMAIN_OUTPUT_KEYS[domainId];
  if (keys === undefined) {
    throw new Error(
      `unknown --domain=${domainId} (valid: ${Object.keys(DOMAIN_OUTPUT_KEYS).sort().join(", ")})`
    );
  }
  return keys;
}

/** @param {string[]} argv */
export function runWorkspaceRegistryCli(argv = process.argv) {
  const checkOnly = argv.includes("--check");
  const strictWebModules = argv.includes("--strict");
  const domainId = parseDomainId(argv);
  const keysToSync = resolveOutputKeys(domainId);

  const manifests = discoverManifests();
  assertMemberPortalL4ReferenceWorkspaces(manifests);
  assertWizardI18nAssets(manifests);
  assertManifestWebModules(manifests, { strict: strictWebModules });
  const generated = generateAllOutputs(manifests);

  if (checkOnly) {
    const onDisk = readOutputs();
    const mismatches = [];
    for (const key of keysToSync) {
      if (onDisk[key] !== generated[key]) {
        mismatches.push(OUTPUT_PATHS[key]);
      }
    }
    if (mismatches.length > 0) {
      const scope = domainId === null ? "" : ` domain=${domainId}`;
      console.error(`generate:workspace-registry --check${scope}: FAIL (stale generated files)`);
      for (const p of mismatches) console.error(`  ${p}`);
      console.error("Run: pnpm run generate:workspace-registry");
      process.exit(1);
    }
    const scope = domainId === null ? "" : ` domain=${domainId}`;
    console.log(
      `generate:workspace-registry --check${scope}: PASS (${manifests.length} manifest(s))`
    );
    return;
  }

  for (const key of keysToSync) {
    writeFileSync(OUTPUT_PATHS[key], generated[key]);
  }

  console.log(
    `generate:workspace-registry — ${manifests.length} manifest(s) → ${keysToSync.length} output(s)${domainId === null ? "" : ` (domain=${domainId})`}`
  );
}
