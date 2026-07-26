// Phase G3 — generateAllOutputs, OUTPUT_PATHS, CLI (--check, --domain)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const { dirname, join } = path;

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
  generateWizardTemplateEnforcementBindings,
  generateWizardTemplatePathAliasBindings,
} from "./domains/settings-api.mjs";
import {
  generateWorkspaceOperatorCapabilities,
  generateWorkspaceCommerceFreezeBindings,
  generateWorkspaceOwnerSettingsPanelLoaders,
} from "./domains/operator.mjs";
import {
  generateWorkspaceFinanceBindings,
  generateWorkspaceFinanceCapabilities,
  generateWorkspaceFinanceDependencyBindings,
  generateWorkspaceFinanceEventReactionBindings,
  generateWorkspaceFinanceChartOfAccountsBindings,
  generateWorkspaceFinanceObligationBindings,
} from "./domains/finance.mjs";
import { generateWorkspaceBookingBindings, generateWorkspaceBookingCapabilities, generateWorkspaceBookingDependencyBindings, generateWorkspaceBookingEventReactionBindings } from "./domains/booking.mjs";
import { generateExposureHostBindings } from "./domains/exposure.mjs";
import { generateWorkspaceIntegrationCapabilities } from "./domains/integration.mjs";
import {
  generateApiWizardRulesBindings,
  generateCanonicalTourBindings,
  generateCatalogRefAllowlistResolvers,
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
  generateGuestTranspilePackages,
  generateAdminTranspilePackages,
  generateAdminClientWorkspaceIgnore,
  generateWorkspaceThemeStylesheets,
  generateWorkspaceThemeCssAmbientModules,
  syncGuestWorkspaceRuntimePackageJson,
  verifyGuestWorkspaceRuntimePackageJson,
  syncAdminWebPackageJson,
  verifyAdminWebPackageJson,
} from "./domains/theme.mjs";
import {
  generateManifestBoundaryAllowlist,
  MANIFEST_BOUNDARY_ALLOWLIST_PATH,
} from "./domains/boundary-allowlist.mjs";
import {
  assertCatalogRegistrationFlowManifest,
  assertCatalogRegistrationTransportInitializerManifest,
  generatePortalRegisterOutputs,
  portalRegisterOutputKey,
  selectPortalRegisterManifests,
  generateWorkspaceIntakePluginBootstrap,
  generateWorkspaceRegistrationFlowPlugins,
  generateWorkspaceRegistrationTransportInitializers,
} from "./domains/registration.mjs";
import {
  generateMarketingCatalogBindings,
  generateWizardCloneRemintBindings,
  generateWizardI18nTranslatorHooks,
  generateWizardMediaBackendRouteBindings,
  generateWizardMediaBindings,
  generateWizardMediaRouteBindings,
  generateWorkspaceWizardMessageLoads,
} from "./domains/wizard-admin.mjs";

/** @type {Record<string, readonly string[]>} */
export const DOMAIN_OUTPUT_KEYS = {
  "core-registry": ["sdk", "api", "web", "manifestBoundaryAllowlist"],
  "tour-api": ["tourWrite", "canonicalTour", "outbox", "catalogRefResolvers", "apiWizardRules"],
  "wizard-admin": [
    "wizardMedia",
    "wizardMediaRoutes",
    "wizardMediaBackendRoutes",
    "wizardI18nTranslators",
    "workspaceWizardMessages",
    "wizardCloneRemint",
    "marketingCatalogBindings",
  ],
  theme: [
    "themeStylesheets",
    "themeCssAmbientModules",
    "guestThemeStylesheetsPortal",
    "guestThemeStylesheetsMarketing",
    "portalGuestTranspilePackages",
    "marketingGuestTranspilePackages",
    "adminTranspilePackages",
    "adminClientWorkspaceIgnore",
  ],
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
    // P5.1 — portal/host register keys resolved dynamically via resolveRegistrationOutputKeys()
  ],
  member: ["memberProfileCapabilities", "memberPortalContracts", "memberPortalSurfaces"],
  http: ["httpRoutes", "httpHandlerLoaders", "httpErrorMap"],
  "settings-api": ["settingsEnrichers", "devBootstrap", "wizardTemplateEnforcement", "wizardTemplatePathAliases"],
  dev: ["devPluginIds"],
  operator: ["operatorCapabilities", "ownerSettingsPanelLoaders", "workspaceCommerceFreeze"],
  finance: [
    "workspaceFinance",
    "workspaceFinanceCapabilities",
    "workspaceFinanceDependencies",
    "workspaceFinanceEventReactions",
    "workspaceFinanceChartOfAccounts",
    "workspaceFinanceObligation",
  ],
  booking: ["workspaceBooking", "workspaceBookingCapabilities", "workspaceBookingDependencies", "workspaceBookingEventReactions"],
  exposure: ["exposureHostBindings"],
  integration: ["integrationCapabilities"],
};

export const OUTPUT_KEYS = Object.freeze([
  "sdk",
  "api",
  "web",
  "manifestBoundaryAllowlist",
  "tourWrite",
  "canonicalTour",
  "wizardMedia",
  "wizardMediaRoutes",
  "wizardMediaBackendRoutes",
  "wizardI18nTranslators",
  "workspaceWizardMessages",
  "wizardCloneRemint",
  "themeStylesheets",
  "themeCssAmbientModules",
  "guestThemeStylesheetsPortal",
  "guestThemeStylesheetsMarketing",
  "portalGuestTranspilePackages",
  "marketingGuestTranspilePackages",
  "adminTranspilePackages",
  "adminClientWorkspaceIgnore",
  "catalogPaths",
  "catalogListFeatures",
  "catalogDetailSections",
  "operatorCapabilities",
  "ownerSettingsPanelLoaders",
  "workspaceCommerceFreeze",
  "workspaceFinance",
  "workspaceFinanceCapabilities",
  "workspaceFinanceDependencies",
  "workspaceFinanceEventReactions",
  "workspaceFinanceChartOfAccounts",
  "workspaceFinanceObligation",
  "workspaceBooking",
  "workspaceBookingCapabilities",
  "workspaceBookingDependencies",
  "workspaceBookingEventReactions",
  "integrationCapabilities",
  "exposureHostBindings",
  "marketingCatalogBindings",
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
  "catalogRefResolvers",
  "apiWizardRules",
  "integrationCapabilities",
  "exposureHostBindings",
  "wizardTemplateEnforcement",
  "wizardTemplatePathAliases",
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

  // P3.1.b — validate registration manifests; do not emit legacy monolithic *FromManifest files.
  // P5.1 — emit portal register-*.generated.ts + portal/host register manifests.
  generateWorkspaceIntakePluginBootstrap(manifests);
  generateWorkspaceRegistrationFlowPlugins(manifests);
  generateWorkspaceRegistrationTransportInitializers(manifests);

  return {
    ...generatePortalRegisterOutputs(manifests),
    sdk: generateSdkBindings(manifests),
    api: generateApiRegistry(manifests),
    web: generateWebLoaders(manifests),
    manifestBoundaryAllowlist: generateManifestBoundaryAllowlist(manifests),
    tourWrite: generateTourWriteBindings(manifests),
    canonicalTour: generateCanonicalTourBindings(manifests),
    wizardMedia: generateWizardMediaBindings(manifests),
    wizardMediaRoutes: generateWizardMediaRouteBindings(manifests),
    wizardMediaBackendRoutes: generateWizardMediaBackendRouteBindings(manifests),
    wizardI18nTranslators: generateWizardI18nTranslatorHooks(manifests),
    workspaceWizardMessages: generateWorkspaceWizardMessageLoads(manifests),
    wizardCloneRemint: generateWizardCloneRemintBindings(manifests),
    themeStylesheets: generateAdminThemeStylesheetLoader(manifests),
    themeCssAmbientModules: generateWorkspaceThemeCssAmbientModules(manifests),
    guestThemeStylesheetsPortal: generateGuestThemeStylesheetLoader(manifests, "portal"),
    guestThemeStylesheetsMarketing: generateGuestThemeStylesheetLoader(manifests, "marketing"),
    portalGuestTranspilePackages: generateGuestTranspilePackages(manifests, "portal"),
    marketingGuestTranspilePackages: generateGuestTranspilePackages(manifests, "marketing"),
    adminTranspilePackages: generateAdminTranspilePackages(manifests),
    adminClientWorkspaceIgnore: generateAdminClientWorkspaceIgnore(manifests),
    catalogPaths: generateWorkspaceCatalogPaths(manifests),
    catalogListFeatures: generateWorkspaceCatalogListFeatures(manifests),
    catalogDetailSections: generateWorkspaceCatalogDetailSections(manifests),
    operatorCapabilities: generateWorkspaceOperatorCapabilities(manifests),
    ownerSettingsPanelLoaders: generateWorkspaceOwnerSettingsPanelLoaders(manifests),
    workspaceCommerceFreeze: generateWorkspaceCommerceFreezeBindings(manifests),
    workspaceFinance: generateWorkspaceFinanceBindings(manifests),
    workspaceFinanceCapabilities: generateWorkspaceFinanceCapabilities(manifests),
    workspaceFinanceDependencies: generateWorkspaceFinanceDependencyBindings(manifests),
    workspaceFinanceEventReactions: generateWorkspaceFinanceEventReactionBindings(manifests),
    workspaceFinanceChartOfAccounts: generateWorkspaceFinanceChartOfAccountsBindings(manifests),
    workspaceFinanceObligation: generateWorkspaceFinanceObligationBindings(manifests),
    workspaceBooking: generateWorkspaceBookingBindings(manifests),
    workspaceBookingCapabilities: generateWorkspaceBookingCapabilities(manifests),
    workspaceBookingDependencies: generateWorkspaceBookingDependencyBindings(manifests),
    workspaceBookingEventReactions: generateWorkspaceBookingEventReactionBindings(manifests),
    integrationCapabilities: generateWorkspaceIntegrationCapabilities(manifests),
    exposureHostBindings: generateExposureHostBindings(manifests),
    marketingCatalogBindings: generateMarketingCatalogBindings(manifests),
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
    catalogRefResolvers: generateCatalogRefAllowlistResolvers(manifests),
    apiWizardRules: generateApiWizardRulesBindings(manifests),
    settingsEnrichers: generateSettingsEnrichers(manifests),
    wizardTemplateEnforcement: generateWizardTemplateEnforcementBindings(manifests),
    wizardTemplatePathAliases: generateWizardTemplatePathAliasBindings(manifests),
    devBootstrap: generateDevBootstrapBindings(manifests),
    wizardTemplateEnforcement: generateWizardTemplateEnforcementBindings(manifests),
    wizardTemplatePathAliases: generateWizardTemplatePathAliasBindings(manifests),
    httpRoutes: generateWorkspaceHttpRoutes(manifests),
    httpHandlerLoaders: generateWorkspaceHttpHandlerLoaders(manifests),
    httpErrorMap: generateWorkspaceHttpErrorMap(manifests),
  };
}

export const OUTPUT_PATHS = {
  sdk: join(REPO_ROOT, "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts"),
  api: join(REPO_ROOT, "apps/api/src/workspace/workspace-plugin-registry.generated.ts"),
  web: join(REPO_ROOT, "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts"),
  manifestBoundaryAllowlist: MANIFEST_BOUNDARY_ALLOWLIST_PATH,
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
  themeStylesheets: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts"
  ),
  themeCssAmbientModules: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-theme-css-modules.generated.d.ts"
  ),
  guestThemeStylesheetsPortal: join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts"
  ),
  guestThemeStylesheetsMarketing: join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.marketing.generated.ts"
  ),
  portalGuestTranspilePackages: join(
    REPO_ROOT,
    "apps/portal/src/bootstrap/guest-transpile-packages.generated.mjs"
  ),
  marketingGuestTranspilePackages: join(
    REPO_ROOT,
    "apps/marketing/src/bootstrap/guest-transpile-packages.generated.mjs"
  ),
  adminTranspilePackages: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/admin-transpile-packages.generated.mjs"
  ),
  adminClientWorkspaceIgnore: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/admin-client-workspace-ignore.generated.mjs"
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
  ownerSettingsPanelLoaders: join(
    REPO_ROOT,
    "apps/web/src/bootstrap/workspace-owner-settings-panel-loaders.generated.ts"
  ),
  workspaceCommerceFreeze: join(
    REPO_ROOT,
    "packages/workspace-sdk/src/metadata/workspace-commerce-freeze.generated.ts"
  ),
  workspaceFinance: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-bindings.generated.ts"
  ),
  workspaceFinanceCapabilities: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-capabilities.generated.ts"
  ),
  workspaceFinanceDependencies: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-dependency-bindings.generated.ts"
  ),
  workspaceFinanceEventReactions: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-event-reaction-bindings.generated.ts"
  ),
  workspaceFinanceChartOfAccounts: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-chart-of-accounts-bindings.generated.ts"
  ),
  workspaceFinanceObligation: join(
    REPO_ROOT,
    "apps/api/src/workspace-finance/workspace-finance-obligation-bindings.generated.ts"
  ),
  workspaceBooking: join(
    REPO_ROOT,
    "apps/api/src/bookings/workspace-booking-bindings.generated.ts"
  ),
  workspaceBookingCapabilities: join(
    REPO_ROOT,
    "apps/api/src/bookings/workspace-booking-capabilities.generated.ts"
  ),
  workspaceBookingDependencies: join(
    REPO_ROOT,
    "apps/api/src/bookings/workspace-booking-dependency-bindings.generated.ts"
  ),
  workspaceBookingEventReactions: join(
    REPO_ROOT,
    "apps/api/src/bookings/workspace-booking-event-reaction-bindings.generated.ts"
  ),
  integrationCapabilities: join(
    REPO_ROOT,
    "apps/api/src/integrations/platform/workspace-integration-capabilities.generated.ts"
  ),
  exposureHostBindings: join(
    REPO_ROOT,
    "apps/api/src/exposure/workspace-exposure-host-bindings.generated.ts"
  ),
  marketingCatalogBindings: join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts"
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
  catalogRefResolvers: join(
    REPO_ROOT,
    "apps/api/src/canonical/workspace-catalog-ref-allowlist-resolvers.generated.ts"
  ),
  apiWizardRules: join(
    REPO_ROOT,
    "apps/api/src/tours/workspace-wizard-rules-bindings.generated.ts"
  ),
  wizardTemplateEnforcement: join(
    REPO_ROOT,
    "apps/api/src/settings/workspace-wizard-template-enforcement-bindings.generated.ts"
  ),
  wizardTemplatePathAliases: join(
    REPO_ROOT,
    "apps/api/src/settings/workspace-wizard-template-path-alias-bindings.generated.ts"
  ),
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

/**
 * P5.1 — portal register paths are membership-dependent (manifest-driven).
 * @param {ReturnType<typeof discoverManifests>} manifests
 */
export function resolveRegistrationOutputKeys(manifests) {
  const selected = selectPortalRegisterManifests(manifests);
  return Object.freeze([
    ...selected.map((m) => portalRegisterOutputKey(m.id)),
    "portalRegisterManifest",
    "hostRegisterManifest",
  ]);
}

/**
 * @param {ReturnType<typeof discoverManifests>} manifests
 * @returns {Record<string, string>}
 */
export function resolveOutputPaths(manifests) {
  /** @type {Record<string, string>} */
  const paths = { ...OUTPUT_PATHS };
  for (const m of selectPortalRegisterManifests(manifests)) {
    paths[portalRegisterOutputKey(m.id)] = join(
      REPO_ROOT,
      `packages/guest-workspace-runtime/src/register-${m.id}.generated.ts`
    );
  }
  paths.portalRegisterManifest = join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts"
  );
  paths.hostRegisterManifest = join(
    REPO_ROOT,
    "packages/workspace-plugin-host/src/workspace-plugin-register-manifest.generated.ts"
  );
  return paths;
}

/** @param {Record<string, string>} outputPaths */
function readOutputs(outputPaths) {
  return Object.fromEntries(
    Object.entries(outputPaths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")])
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

/**
 * @param {string | null} domainId
 * @param {ReturnType<typeof discoverManifests>} manifests
 */
function resolveOutputKeys(domainId, manifests) {
  const registrationKeys = resolveRegistrationOutputKeys(manifests);
  if (domainId === null) {
    return [...OUTPUT_KEYS, ...registrationKeys];
  }
  if (domainId === "registration") {
    return [...registrationKeys];
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

  const manifests = discoverManifests();
  const keysToSync = resolveOutputKeys(domainId, manifests);
  const outputPaths = resolveOutputPaths(manifests);
  assertMemberPortalL4ReferenceWorkspaces(manifests);
  assertWizardI18nAssets(manifests);
  assertManifestWebModules(manifests, { strict: strictWebModules });
  const generated = generateAllOutputs(manifests);

  if (checkOnly) {
    const onDisk = readOutputs(outputPaths);
    const mismatches = [];
    for (const key of keysToSync) {
      if (onDisk[key] !== generated[key]) {
        mismatches.push(outputPaths[key]);
      }
    }
    if (mismatches.length > 0) {
      const scope = domainId === null ? "" : ` domain=${domainId}`;
      console.error(`generate:workspace-registry --check${scope}: FAIL (stale generated files)`);
      for (const p of mismatches) console.error(`  ${p}`);
      console.error("Run: pnpm run generate:workspace-registry");
      process.exit(1);
    }
    const depCheck = verifyGuestWorkspaceRuntimePackageJson(manifests);
    if (!depCheck.ok) {
      console.error(
        "generate:workspace-registry --check: FAIL (guest-workspace-runtime package.json product deps stale)"
      );
      console.error(`  expected: ${Object.keys(depCheck.expected).join(", ")}`);
      console.error(`  actual:   ${Object.keys(depCheck.actual).join(", ")}`);
      console.error("Run: pnpm run generate:workspace-registry");
      process.exit(1);
    }
    const webDepCheck = verifyAdminWebPackageJson(manifests);
    if (!webDepCheck.ok) {
      console.error(
        "generate:workspace-registry --check: FAIL (apps/web package.json product deps stale)"
      );
      console.error(
        `  expected products: ${Object.keys(webDepCheck.expectedDevDependencies)
          .filter((n) => n.startsWith("@app-tour/workspace-") && n !== "@app-tour/workspace-sdk")
          .join(", ")}`
      );
      console.error(
        `  actual products:   ${Object.keys(webDepCheck.actualDevDependencies)
          .filter((n) => n.startsWith("@app-tour/workspace-") && n !== "@app-tour/workspace-sdk")
          .join(", ")}`
      );
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
    const outPath = outputPaths[key];
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, generated[key]);
  }

  if (syncGuestWorkspaceRuntimePackageJson(manifests)) {
    console.log("generate:workspace-registry — synced packages/guest-workspace-runtime/package.json product deps");
  }

  if (syncAdminWebPackageJson(manifests)) {
    console.log("generate:workspace-registry — synced apps/web/package.json product deps");
  }

  console.log(
    `generate:workspace-registry — ${manifests.length} manifest(s) → ${keysToSync.length} output(s)${domainId === null ? "" : ` (domain=${domainId})`}`
  );
}
