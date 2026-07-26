import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(__dirname, "..");

/** Public dist surface — KS-04 (legacy/denali coupling: separate *.contract.spec.ts). */
const REQUIRED_DIST_EXPORTS = [
  "WORKSPACE_SDK_VERSION",
  "assertCanonicalDocument",
  "createCanonicalDocument",
  "parseCanonicalDocumentFromStorage",
  "parseWorkspacePluginFromStorage",
  "getStarterWorkspacePlugin",
  "starterWorkspacePlugin",
  "isWorkspacePlugin",
  "validateWorkspacePlugin",
  "getWorkspaceThemePresets",
  "workspaceThemePresets",
  "resolveWorkspacePluginIdForType",
  "STARTER_WORKSPACE_TYPE",
] as const;

const REQUIRED_AUTH_EXPORTS = ["buildTenantAuthz", "canAccessWorkspaceTheme"] as const;

/** P0-GATE-04 — frozen root barrel runtime surface; new exports require explicit allowlist update. */
const ALLOWED_ROOT_RUNTIME_EXPORTS = new Set([
  "CanonicalDocumentValidationError",
  "DEFAULT_WORKSPACE_TYPE_BINDINGS",
  "IngressSanitizationError",
  "OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES",
  "OPERATOR_AVATAR_MAX_BYTES",
  "OPERATOR_PROFILE_GENDERS",
  "STARTER_THEME_TOKENS_STYLESHEET",
  "STARTER_WORKSPACE_PLUGIN_ID",
  "STARTER_WORKSPACE_TYPE",
  "TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES",
  "TENANT_BRAND_LOGO_MAX_BYTES",
  "UnknownCatalogPluginError",
  "UnknownCatalogRegistrationPluginError",
  "CatalogRegistrationPayloadInvalidError",
  "WORKSPACE_SDK_VERSION",
  "WORKSPACE_THEME_CSS_VARIABLE",
  "WorkspacePluginIngressError",
  "WorkspacePluginShapeError",
  "WorkspaceThemeValidationError",
  "assertCanonicalDocument",
  "assertCanonicalDocumentRoots",
  "assertCanonicalPathSegments",
  "assertOperatorAvatarBytesMatchContentType",
  "assertOperatorAvatarKeyScope",
  "assertStablePlainPrototype",
  "assertTenantBrandLogoBytesMatchContentType",
  "assertTenantBrandLogoKeyTenantScope",
  "assertTenantThemeSealed",
  "assertWorkspacePlugin",
  "assertWorkspaceThemeContract",
  "assertWorkspaceThemeSealed",
  "buildOperatorAvatarObjectKey",
  "buildTenantAuthz",
  "buildTenantBrandLogoObjectKey",
  "buildTourAuthHeaders",
  "buildTourListProjection",
  "canAccessWorkspaceTheme",
  "createCanonicalDocument",
  "catalogListSupportsServerFilter",
  "createStarterWorkspacePlugin",
  "createTenantAuthz",
  "evaluateMemberPortalEntitlements",
  "evaluateMemberPortalEntitlementsForSurface",
  "ensureWizardHostReady",
  "explainWorkspacePluginRejection",
  "formatCanonicalPathToLabel",
  "freezeCanonicalDocumentData",
  "getStarterWorkspacePlugin",
  "getWorkspaceRuleCell",
  "getWorkspaceThemePresets",
  "isNonEmptyRootValue",
  "isOperatorAvatarContentType",
  "isOperatorAvatarStorageKey",
  "isOperatorProfileGender",
  "isTenantBrandLogoContentType",
  "isTenantBrandLogoStorageKey",
  "isTenantBrandingEmpty",
  "isWorkspaceOwner",
  "isWorkspacePlugin",
  "isWorkspaceSdkValidationError",
  "isWorkspaceTypeId",
  "noopWorkspaceDraftTombstoneBinding",
  "noopWorkspaceValidationHooks",
  "normalizeTenantCssKey",
  "operatorCapabilitySupportsFieldExposureSurfaces",
  "operatorCapabilitySupportsReconciliationTriage",
  "operatorCapabilitySupportsUsersDirectory",
  "normalizeThemeCssKey",
  "parseCanonicalDocumentFromStorage",
  "parseTenantAuthContext",
  "parseWorkspacePluginFromStorage",
  "PUBLIC_CATALOG_REGISTRATION_TRANSPORT_KINDS",
  "readOwnDataProperty",
  "buildCatalogRegistrationUpstreamRequest",
  "formatRegistrationIntakeTransportLabel",
  "isPublicCatalogOrganizedTransportMode",
  "isWorkspaceLifecycleTransitionAllowed",
  "isWorkspaceUnpublishTransitionAllowed",
  "parseRegistrationIntakeRecord",
  "registerWorkspaceIntakePlugin",
  "IntakePluginNotRegisteredError",
  "resolveIntakeSchema",
  "resolveCatalogRegistrationApiPath",
  "resolveCatalogListApiPath",
  "resolveCatalogTourApiPath",
  "resolveCatalogListFeatures",
  "resolveCatalogDetailSections",
  "resolveGuestSeoForPlugin",
  "supportsCatalogRegistration",
  "resolveEffectiveTenantBranding",
  "resolveDraftShellCapability",
  "resolveHostProbeCapability",
  "resolveCreateChromeCapability",
  "ensureCreateChromeReady",
  "resolveFlatEditChromeCapability",
  "ensureFlatEditChromeReady",
  "resolveCreateViewCapability",
  "ensureCreateViewReady",
  "resolveFlatEditFormCapability",
  "ensureFlatEditFormReady",
  "resolveFlatEditPageCapability",
  "ensureFlatEditPageReady",
  "resolveTemplateGateCapability",
  "resolveOperatorUiCapability",
  "ensureOperatorUiReady",
  "resolveTourActionSubmitCapability",
  "resolveLabelsCapability",
  "ensureLabelsReady",
  "resolveWizardSurfacesCapability",
  "ensureWizardSurfacesReady",
  "resolveTemplatePresetCapability",
  "resolveSettingsHubFallbackCapability",
  "resolveTemplateEditorCapability",
  "resolveTourListCategoryCapability",
  "resolveSettingsDestinationCapability",
  "resolveSettingsEquipmentUiCapability",
  "ensureSettingsEquipmentUiReady",
  "resolveSettingsExposureSurfacesUiCapability",
  "ensureSettingsExposureSurfacesUiReady",
  "resolveOperatorShellNavCapability",
  "resolveFinanceNavCapability",
  "resolveFinanceOpsCapability",
  "resolveBookingOpsCapability",
  "resolveWizardCreateCapability",
  "resolveWizardHostCapability",
  "resolveWorkspacePluginIdForType",
  "sdkErr",
  "sdkOk",
  "snapshotWorkspaceTheme",
  "sniffOperatorAvatarContentType",
  "sniffTenantBrandLogoContentType",
  "starterWorkspacePlugin",
  "topLevelRootsRemoved",
  "tryParseCanonicalDocumentFromStorage",
  "tryParseTenantAuthContext",
  "tryParseWorkspacePluginFromStorage",
  "tryValidateTenantTheme",
  "validateFieldPolicyManifest",
  "validateIntegrationSurface",
  "validateExposureSurface",
  "validateRegistrationOpsManifest",
  "validateSettingsManifest",
  "validateTenantTheme",
  "validateWorkspacePlugin",
  "clearWorkspaceIntakePluginRegistryForTests",
  "clearWorkspaceRegistrationFlowRegistryForTests",
  "getWorkspaceIntakePlugin",
  "getWorkspaceRegistrationFlowPlugin",
  "GuestConformanceNotConfiguredError",
  "ProductionCertificationNotConfiguredError",
  "GuestCrossSurfaceNavNotConfiguredError",
  "GuestSeoNotConfiguredError",
  "GUEST_CROSS_SURFACE_PLATFORM_MOTHER_ONLY_PATHS",
  "listWorkspaceIntakePluginIds",
  "listWorkspaceRegistrationFlowPluginIds",
  "MEMBER_PROFILE_DISPLAY_NAME_MAX_LENGTH",
  "MEMBER_PROFILE_FATHER_NAME_MAX_LENGTH",
  "MEMBER_PROFILE_FIELD_IDS",
  "MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD",
  "MEMBER_PORTAL_MORE_ROUTE_PATH",
  "MemberPortalUnknownRouteError",
  "MemberProfileNotConfiguredError",
  "memberPortalEntitlementKey",
  "mergeFlowState",
  "applyCatalogRegistrationFlowEvent",
  "mergePlatformMemberPortalModules",
  "PLATFORM_MEMBER_PORTAL_HOME_MODULE",
  "registerWorkspaceRegistrationFlowPlugin",
  "resolveEffectiveIntakeSchema",
  "requireGuestCrossSurfaceNav",
  "resolveGuestConformanceLevelForPlugin",
  "resolveProductionCertificationForPlugin",
  "resolveGuestCrossSurfaceNav",
  "resolveGuestLandingFeatures",
  "resolveIntakeSubmitValues",
  "resolveMemberPortalHubPresentation",
  "resolveMemberPortalSecondaryModules",
  "resolveMemberProfileCapabilities",
  "resolveMemberPortalDefaultRoutePath",
  "resolveMemberPortalModuleRoutePath",
  "resolveMemberPortalModuleByRoutePath",
  "resolveMemberPortalModules",
  "resolveMemberPortalContract",
  "isMemberPortalEnabled",
  "tryResolveMemberPortalDefaultRoutePath",
  "defineCatalogRegistrationFlowSurface",
  "MemberPortalDisabledError",
  "assertMemberPortalEnabled",
  "listMemberPortalDefaultGrantedEntitlementKeys",
  "listMemberPortalEntitlementKeys",
  "MemberPortalNotConfiguredError",
  "validateMemberPortalManifest",
  "MEMBER_PORTAL_RESERVED_MODULE_IDS",
  "resolveMemberProfileFieldValidator",
  "shouldRenderMemberPortalMoreHub",
  "transitionFlowStep",
  "UnknownCatalogPresentationPluginError",
  "UnknownGuestLandingPluginError",
  "validateGuestCrossSurfaceNavLinks",
  "validateIntakeSchemaValues",
  "validateMemberProfileBirthDate",
  "validateMemberProfileDisplayName",
  "validateMemberProfileFatherName",
  "validateMemberProfileGender",
  "validateMemberProfileNationalId",
  "validateStructuredData",
  "WORKSPACE_GUEST_CONFORMANCE_LEVELS",
  "WORKSPACE_PRODUCTION_CERTIFICATION",
  "WORKSPACE_GUEST_LANDING",
  "WORKSPACE_GUEST_SEO",
  "WORKSPACE_OPERATOR_CAPABILITIES",
  "workspaceAccentCssValue",
  "workspaceSdkValidationErrorCode",
  "workspaceThemePresets",
  "workspaceTypesFromPlugin",
]);

const IGNORED_RUNTIME_META_KEYS = new Set(["__esModule", "default", "module.exports"]);

describe("workspace-sdk foundation contract", () => {
  describe("dist publish surface", () => {
    it("defines package exports and built entry files (KS-04)", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(SDK_ROOT, "package.json"), "utf8")) as {
        main?: string;
        types?: string;
        exports?: Record<string, { types?: string; default?: string }>;
      };

      const mainRel = pkg.exports?.["."]?.default ?? pkg.main;
      const typesRel = pkg.exports?.["."]?.types ?? pkg.types;
      const authRel = pkg.exports?.["./auth"]?.default;
      assert.equal(typeof mainRel, "string", "package.json must declare dist entry");
      assert.equal(typeof typesRel, "string", "package.json must declare dist types");
      assert.equal(typeof authRel, "string", "package.json must declare ./auth subpath");

      assert.ok(fs.existsSync(path.join(SDK_ROOT, mainRel!)), `missing built entry: ${mainRel}`);
      assert.ok(fs.existsSync(path.join(SDK_ROOT, typesRel!)), `missing built types: ${typesRel}`);
      assert.ok(fs.existsSync(path.join(SDK_ROOT, authRel!)), `missing built auth: ${authRel}`);
    });

    it("imports dist entry and exposes required public exports (subprocess)", () => {
      const probe = `
        const sdk = await import(${JSON.stringify(path.join(SDK_ROOT, "dist/index.js"))});
        const names = ${JSON.stringify([...REQUIRED_DIST_EXPORTS])};
        for (const name of names) {
          if (!(name in sdk)) {
            console.error("missing export:", name);
            process.exit(1);
          }
        }
        if (sdk.WORKSPACE_SDK_VERSION !== 1) process.exit(2);
        const doc = sdk.createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: { title: "ok" } },
        });
        sdk.assertCanonicalDocument(doc);
        console.log("DIST_SURFACE_OK");
      `;
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: SDK_ROOT,
        encoding: "utf8",
      });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
      assert.equal(r.status, 0, out);
      assert.match(out, /DIST_SURFACE_OK/);
    });

    it("root barrel has no undeclared runtime exports (P0-GATE-04 allowlist)", () => {
      const allowed = [...ALLOWED_ROOT_RUNTIME_EXPORTS];
      const ignored = [...IGNORED_RUNTIME_META_KEYS];
      const probe = `
        const sdk = await import(${JSON.stringify(path.join(SDK_ROOT, "dist/index.js"))});
        const allowed = new Set(${JSON.stringify(allowed)});
        const ignored = new Set(${JSON.stringify(ignored)});
        const runtimeNames = Object.keys(sdk).filter((name) => !ignored.has(name));
        const unexpected = runtimeNames.filter((name) => !allowed.has(name));
        const missing = [...allowed].filter((name) => !(name in sdk));
        if (unexpected.length) {
          console.error("unexpected:", unexpected.join(", "));
          process.exit(1);
        }
        if (missing.length) {
          console.error("missing:", missing.join(", "));
          process.exit(2);
        }
        console.log("ROOT_BARREL_ALLOWLIST_OK");
      `;
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: SDK_ROOT,
        encoding: "utf8",
      });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
      assert.equal(r.status, 0, out);
      assert.match(out, /ROOT_BARREL_ALLOWLIST_OK/);
    });

    it("root index documents transitional TourClient surface (P0-SDK-02 deferred)", () => {
      const indexSrc = fs.readFileSync(path.join(SDK_ROOT, "src/index.ts"), "utf8");
      assert.match(indexSrc, /tour-client\.contract/);
      assert.match(indexSrc, /TourClient/);
    });

    it("auth subpath exposes buildTenantAuthz and denies cross-tenant theme access", () => {
      const probe = `
        const auth = await import(${JSON.stringify(path.join(SDK_ROOT, "dist/auth/index.js"))});
        const names = ${JSON.stringify([...REQUIRED_AUTH_EXPORTS])};
        for (const name of names) {
          if (!(name in auth)) {
            console.error("missing auth export:", name);
            process.exit(1);
          }
        }
        const authz = auth.buildTenantAuthz({
          userId: "u1",
          tenantId: "tenant-a",
          workspaceId: "ws-1",
          role: "member",
          status: "ACTIVE",
        });
        const denied = auth.canAccessWorkspaceTheme({
          authz,
          access: { tenantId: "tenant-b", workspaceId: "ws-1", pluginId: "starter" },
          pluginId: "starter",
        });
        if (denied !== false) process.exit(2);
        console.log("AUTH_BEHAVIOR_OK");
      `;
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: SDK_ROOT,
        encoding: "utf8",
      });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
      assert.equal(r.status, 0, out);
      assert.match(out, /AUTH_BEHAVIOR_OK/);
    });
  });
});
