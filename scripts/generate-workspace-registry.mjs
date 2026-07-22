#!/usr/bin/env node
// DEC-P10-001 — discovers workspace.manifest.json under packages/workspaces/
// Emits host + SDK registry files. Run: pnpm run generate:workspace-registry
// Phase G3 — domain modules + orchestrator; public re-exports for tests.
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertMemberPortalL4ReferenceWorkspaces,
  assertMemberPortalManifest,
  generateWorkspaceMemberPortalContracts,
  generateWorkspaceMemberPortalSurfaces,
  normalizeMemberPortalAvailability,
  resolveEffectiveMemberPortalConfig,
} from "./codegen/workspace-registry/domains/member-portal.mjs";

import { discoverManifests } from "./codegen/workspace-registry/manifest-loader.mjs";
import {
  assertManifestWebModules,
  assertNoDottedKeysInWizardJson,
  assertPackageWebModule,
  assertWizardI18nAssets,
} from "./codegen/workspace-registry/validation.mjs";
import {
  generateApiRegistry,
  generateSdkBindings,
  generateWebLoaders,
} from "./codegen/workspace-registry/domains/core-registry.mjs";
import {
  assertHttpRoutesManifest,
  generateWorkspaceHttpErrorMap,
  generateWorkspaceHttpHandlerLoaders,
  generateWorkspaceHttpRoutes,
} from "./codegen/workspace-registry/domains/http-routes.mjs";
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
} from "./codegen/workspace-registry/domains/guest-catalog.mjs";
import {
  assertDevBootstrapPluginTenantIds,
  generateWorkspaceDevPluginIds,
} from "./codegen/workspace-registry/domains/dev.mjs";
import {
  generateDevBootstrapBindings,
  generateSettingsEnrichers,
} from "./codegen/workspace-registry/domains/settings-api.mjs";
import { generateWorkspaceOperatorCapabilities } from "./codegen/workspace-registry/domains/operator.mjs";
import {
  generateCanonicalTourBindings,
  generateOutboxSideEffects,
  generateTourWriteBindings,
} from "./codegen/workspace-registry/domains/tour-api.mjs";
import {
  assertMemberProfileManifest,
  generateWorkspaceMemberProfileCapabilities,
} from "./codegen/workspace-registry/domains/member.mjs";
import {
  generateAdminThemeStylesheetLoader,
  generateGuestThemeStylesheetLoader,
  generateGuestThemeStylesheets,
  generateWorkspaceThemeStylesheets,
} from "./codegen/workspace-registry/domains/theme.mjs";
import {
  generateManifestBoundaryAllowlist,
} from "./codegen/workspace-registry/domains/boundary-allowlist.mjs";
import {
  assertCatalogRegistrationFlowManifest,
  assertCatalogRegistrationTransportInitializerManifest,
  generatePortalPluginRegister,
  generatePortalRegisterOutputs,
  generateWorkspaceIntakePluginBootstrap,
  generateWorkspaceRegistrationFlowPlugins,
  generateWorkspaceRegistrationTransportInitializers,
  portalRegisterOutputKey,
  selectPortalRegisterManifests,
} from "./codegen/workspace-registry/domains/registration.mjs";
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
  generateWizardTemplatePresetBindings,
  generateWorkspaceWizardMessageLoads,
} from "./codegen/workspace-registry/domains/wizard-admin.mjs";

export {
  generateAllOutputs,
  OUTPUT_KEYS,
  OUTPUT_PATHS,
  DOMAIN_OUTPUT_KEYS,
  resolveOutputPaths,
  resolveRegistrationOutputKeys,
  runWorkspaceRegistryCli,
} from "./codegen/workspace-registry/orchestrator.mjs";

export {
  assertMemberPortalL4ReferenceWorkspaces,
  assertMemberPortalManifest,
  normalizeMemberPortalAvailability,
  resolveEffectiveMemberPortalConfig,
  assertNoDottedKeysInWizardJson,
  assertWizardI18nAssets,
  assertPackageWebModule,
  assertManifestWebModules,
  discoverManifests,
  generateSdkBindings,
  generateApiRegistry,
  generateWebLoaders,
  assertHttpRoutesManifest,
  generateWorkspaceHttpRoutes,
  generateWorkspaceHttpHandlerLoaders,
  generateWorkspaceHttpErrorMap,
  extractCatalogPathsFromManifest,
  generateWorkspaceCatalogPaths,
  generateWorkspaceGuestConformance,
  resolveGuestConformanceLevel,
  generateWorkspaceProductionCertification,
  resolveProductionCertificationTier,
  assertGuestExtensionsManifest,
  assertGuestCrossSurfaceNavManifest,
  assertCatalogPresentationManifest,
  assertGuestLandingManifest,
  assertGuestSeoManifest,
  generateWorkspaceGuestCrossSurfaceNav,
  generateWorkspaceGuestSeo,
  generateWorkspaceGuestLanding,
  generateWorkspaceCatalogListFeatures,
  generateWorkspaceCatalogDetailSections,
  generateCanonicalTourBindings,
  generateTourWriteBindings,
  generateOutboxSideEffects,
  generateSettingsEnrichers,
  generateDevBootstrapBindings,
  generateWorkspaceOperatorCapabilities,
  assertDevBootstrapPluginTenantIds,
  generateWorkspaceDevPluginIds,
  assertMemberProfileManifest,
  generateWorkspaceMemberProfileCapabilities,
  generateWorkspaceThemeStylesheets,
  generateAdminThemeStylesheetLoader,
  generateGuestThemeStylesheets,
  generateGuestThemeStylesheetLoader,
  assertCatalogRegistrationFlowManifest,
  assertCatalogRegistrationTransportInitializerManifest,
  generateWorkspaceRegistrationFlowPlugins,
  generateWorkspaceRegistrationTransportInitializers,
  generateWorkspaceIntakePluginBootstrap,
  generatePortalRegisterOutputs,
  generatePortalPluginRegister,
  selectPortalRegisterManifests,
  portalRegisterOutputKey,
  generateManifestBoundaryAllowlist,
  generateWizardMediaBindings,
  generateWizardMediaRouteBindings,
  generateWizardMediaBackendRouteBindings,
  generateWizardSurfaceBindings,
  generateWizardLabelBindings,
  generateWizardI18nTranslatorHooks,
  generateWorkspaceWizardMessageLoads,
  generateWizardCloneRemintBindings,
  generateWizardCreateBindings,
  generateWizardTemplateEditorBindings,
  generateMarketingCatalogBindings,
  generateSettingsDestinationBindings,
  generateSettingsEquipmentUiBindings,
  generateTourActionSubmitBindings,
  generatePhotoUploadErrorsBindings,
  generateTourListCategoryBindings,
  generateOperatorUiComponentsBindings,
  generateWizardDraftUnificationBindings,
  generateWizardRulesBindings,
  generateWizardTemplatePresetBindings,
  generateWizardDraftShellBindings,
  generateWizardCreateChromeBindings,
  generateWizardFlatEditChromeBindings,
  generateWizardFlatEditFormBindings,
  generateWizardFlatEditPageBindings,
  generateWizardCreateViewBindings,
  generateWizardCompositeRegistryBindings,
  generateSettingsHubFallbackBindings,
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const { runWorkspaceRegistryCli } = await import("./codegen/workspace-registry/orchestrator.mjs");
  runWorkspaceRegistryCli();
}
