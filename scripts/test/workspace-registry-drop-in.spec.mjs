/**
 * P7-T06 — drop-in workspace manifest fixture validates without trunk package dir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertExportFunctionsHaveUniqueConstBindings,
  assertNoDuplicateEmittedSymbols,
} from "../codegen/workspace-registry/utils.mjs";

import {
  assertPackageWebModule,
  discoverManifests,
  extractCatalogPathsFromManifest,
  generateDevBootstrapBindings,
  generateOutboxSideEffects,
  generateSdkBindings,
  generateSettingsEnrichers,
  generateWizardMediaBackendRouteBindings,
  generateWizardMediaRouteBindings,
  generateWorkspaceCatalogPaths,
  generateWorkspaceRegistrationForTourPaths,
  extractRegistrationForTourPathFromManifest,
  generateWorkspaceCatalogListFeatures,
  generateWorkspaceCatalogDetailSections,
  generateWorkspaceGuestLanding,
  assertGuestLandingManifest,
  generateWorkspaceMemberProfileCapabilities,
  generateWorkspaceDevPluginIds,
  generateWorkspaceGuestConformance,
  resolveGuestConformanceLevel,
  generateWorkspaceProductionCertification,
  resolveProductionCertificationTier,
  generateWorkspaceRegistrationFlowPlugins,
  generateWorkspaceHttpRoutes,
  generateWorkspaceThemeStylesheets,
  generateAdminThemeStylesheetLoader,
  generateWebLoaders,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_MANIFEST = join(
  REPO_ROOT,
  "test/fixtures/workspaces/climbing-club/workspace.manifest.json"
);

describe("workspace registry drop-in (P7-T06)", () => {
  it("trunk manifests discover all registered workspace packages", () => {
    const manifests = discoverManifests();
    const ids = manifests.map((m) => m.id).sort();
    assert.deepEqual(ids, [
      "acme",
      "alpine",
      "booking-ws2",
      "cert-club",
      "cert-events",
      "denali",
      "finance-ws2",
      "finance-ws3",
      "finance-ws4",
      "finance-ws5",
      "finance-ws6",
      "guest-club",
      "harbor",
      "policy-cert",
      "profile-cert",
      "starter",
      "urban",
    ]);
  });

  it("climbing-club fixture merges into generated bindings without packages/workspaces/climbing-club", () => {
    const trunk = discoverManifests();
    const fixture = JSON.parse(readFileSync(FIXTURE_MANIFEST, "utf8"));
    const merged = [...trunk, fixture].sort((a, b) => a.id.localeCompare(b.id));
    const sdk = generateSdkBindings(merged);
    assert.match(sdk, /workspaceType: "climbing-club"/);
    assert.match(sdk, /pluginId: "climbing-club"/);
    assert.equal(merged.find((m) => m.id === "climbing-club")?.workspaceTypes[0], "climbing-club");
  });

  it("P15-W-B5 generateAdminThemeStylesheetLoader emits dynamic admin skin loader", () => {
    const manifests = discoverManifests();
    const generated = generateAdminThemeStylesheetLoader(manifests);
    assert.match(generated, /importAdminThemeForPlugin/);
    assert.match(generated, /resolveAdminThemeStylesheets/);
    assert.match(generated, /listAdminThemeRegistryPluginIds/);
    assert.doesNotMatch(generated, /export const WORKSPACE_ADMIN_THEME_REGISTRY/);
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-admin\.css/);
    assert.doesNotMatch(generated, /^import ["']@app-tour\/workspace-/m);
    assert.throws(
      () =>
        generateAdminThemeStylesheetLoader([
          {
            id: "bad-theme",
            package: "@app-tour/workspace-bad",
            themeStylesheets: [""],
          },
        ]),
      /themeStylesheets entries must be non-empty strings/
    );
  });

  it("P15-W-B6 generateWizardMediaRouteBindings maps denali legacy BFF alias", () => {
    const manifests = discoverManifests();
    const generated = generateWizardMediaRouteBindings(manifests);
    assert.match(generated, /"wizard-photos": "\/api\/wizard-media\/wizard-photos"/);
    assert.match(generated, /isKnownWizardMediaRouteBffKey/);
    assert.throws(
      () =>
        generateWizardMediaRouteBindings([
          {
            id: "bad-media",
            wizardMedia: { mediaRouteKey: "" },
          },
        ]),
      /wizardMedia\.mediaRouteKey is required/
    );
    const neutral = generateWizardMediaRouteBindings([
      {
        id: "future",
        wizardMedia: { mediaRouteKey: "future-media" },
      },
    ]);
    assert.match(neutral, /"future-media": "\/api\/wizard-media\/future-media"/);
  });

  it("P15-W-B6 generateWizardMediaBackendRouteBindings maps denali API proxy paths", () => {
    const manifests = discoverManifests();
    const generated = generateWizardMediaBackendRouteBindings(manifests);
    assert.match(generated, /upload: "\/tours\/wizard-photos"/);
    assert.match(generated, /signedUrl: "\/tours\/wizard-photos\/url"/);
    assert.throws(
      () =>
        generateWizardMediaBackendRouteBindings([
          {
            id: "bad-backend",
            wizardMedia: { mediaRouteKey: "x", legacyBackendUploadPath: "" },
          },
        ]),
      /legacyBackendUploadPath and legacyBackendSignedUrlPath are required/
    );
  });

  it("P0-PR-1 generateOutboxSideEffects: financeEventReaction skips binding run AND Denali reexports", () => {
    const manifests = discoverManifests();
    const generated = generateOutboxSideEffects(manifests);
    assert.doesNotMatch(
      generated,
      /@app-tour\/workspace-denali\/host\/finance\/api-tour-created-adapter/
    );
    assert.doesNotMatch(generated, /registerTourCreatedFinanceSideEffectDeps/);
    assert.doesNotMatch(generated, /runTourCreatedFinanceSideEffect/);
    assert.doesNotMatch(generated, /workspace-denali/);
    assert.match(generated, /WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS[\s\S]*=\s*\[\]/);
    assert.doesNotMatch(generated, /run:\s*runTourCreatedFinanceSideEffect/);
    assert.throws(
      () =>
        generateOutboxSideEffects([
          {
            id: "bad-outbox",
            package: "@app-tour/workspace-bad",
            events: [{ eventType: "TourCreated" }],
          },
        ]),
      /hostSideEffect is required/
    );
    assert.throws(
      () =>
        generateOutboxSideEffects([
          {
            id: "bad-dispatch",
            package: "@app-tour/workspace-bad",
            events: [
              {
                eventType: "TourCreated",
                hostSideEffect: {
                  adapterModule: "./finance/x",
                  export: "runX",
                  dispatchVia: "other",
                },
              },
            ],
          },
        ]),
      /dispatchVia must be "financeEventReaction"/
    );
  });

  it("merge-safe: tour-api.mjs export functions have unique const bindings", () => {
    const tourApiPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../codegen/workspace-registry/domains/tour-api.mjs"
    );
    const source = readFileSync(tourApiPath, "utf8");
    assertExportFunctionsHaveUniqueConstBindings(source, "domains/tour-api.mjs");
  });

  it("merge-safe: assertNoDuplicateEmittedSymbols rejects duplicate top-level const", () => {
    assert.throws(
      () =>
        assertNoDuplicateEmittedSymbols(
          `export const FOO = 1;\nexport const FOO = 2;\n`,
          "fixture"
        ),
      /duplicate emitted symbols.*FOO/
    );
    assert.doesNotThrow(() =>
      assertNoDuplicateEmittedSymbols(
        `export type Foo = string;\nexport const BAR = 1;\nexport function baz(): void {}\n`,
        "fixture"
      )
    );
  });

  it("P0-PR-1 generateSettingsEnrichers emits denali bindings from manifest", () => {
    const manifests = discoverManifests();
    const generated = generateSettingsEnrichers(manifests);
    assert.match(generated, /WORKSPACE_SETTINGS_ENRICHER_BINDINGS = \[/);
    assert.match(generated, /workspaceType: "denali"/);
    assert.match(generated, /resolveThemeCompatibleCategories/);
    assert.match(generated, /resolveEquipmentCompatibleCategories/);
    assert.match(generated, /enrichSettingsModuleList/);
  });

  it("P0-PR-1 generateDevBootstrapBindings emits denali and urban wizard templates", () => {
    const manifests = discoverManifests();
    const generated = generateDevBootstrapBindings(manifests);
    assert.match(generated, /buildDenaliTenantWizardTemplatePayload/);
    assert.match(generated, /buildUrbanMinimalWizardTemplatePayload/);
    assert.match(generated, /DENALI_SMOKE_TENANT_ID/);
    assert.match(generated, /URBAN_SMOKE_TENANT_ID/);
  });

  it("P0-PR-5 assertPackageWebModule accepts package paths; shell @/ fails in strict", () => {
    assert.doesNotThrow(() =>
      assertPackageWebModule("denali", "@app-tour/workspace-denali/ui/composite-surface", {
        strict: true,
      })
    );
    assert.throws(
      () =>
        assertPackageWebModule("denali", "@/wizard/denali/denali-composite-surface-factory", {
          strict: true,
        }),
      /should use @app-tour\/workspace-\* package export/
    );
  });

  it("PF-0.1 extractCatalogPathsFromManifest resolves denali and urban list paths", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((m) => m.id === "denali");
    const urban = manifests.find((m) => m.id === "urban");
    const starter = manifests.find((m) => m.id === "starter");
    assert.ok(denali);
    assert.ok(urban);
    assert.ok(starter);
    assert.deepEqual(extractCatalogPathsFromManifest(denali), {
      pluginId: "denali",
      listPath: "/denali/catalog",
    });
    assert.deepEqual(extractCatalogPathsFromManifest(urban), {
      pluginId: "urban",
      listPath: "/urban/catalog",
    });
    assert.equal(extractCatalogPathsFromManifest(starter), null);
  });

  it("PF-0.1c extractRegistrationForTourPathFromManifest is denali-only on trunk", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((m) => m.id === "denali");
    const urban = manifests.find((m) => m.id === "urban");
    const starter = manifests.find((m) => m.id === "starter");
    assert.ok(denali);
    assert.ok(urban);
    assert.ok(starter);
    assert.deepEqual(extractRegistrationForTourPathFromManifest(denali), {
      pluginId: "denali",
      registrationApiPath: "/denali/registrations",
    });
    assert.equal(extractRegistrationForTourPathFromManifest(urban), null);
    assert.equal(extractRegistrationForTourPathFromManifest(starter), null);
    const generated = generateWorkspaceRegistrationForTourPaths(manifests);
    assert.match(generated, /"denali": "\/denali\/registrations"/);
    assert.doesNotMatch(generated, /"urban":/);
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("PF-0.1 generateWorkspaceCatalogPaths matches legacy SDK map", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceCatalogPaths(manifests);
    assert.match(generated, /"denali": "\/denali\/catalog"/);
    assert.match(generated, /"urban": "\/urban\/catalog"/);
    assert.match(generated, /"guest-club": "\/guest-club\/catalog"/);
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("PF-0.1b generateWorkspaceHttpRoutes uses underscore const prefixes for hyphen workspace ids", () => {
    const generated = generateWorkspaceHttpRoutes(discoverManifests());
    assert.match(generated, /GUEST_CLUB_GUEST_CLUB_HTTP_ROUTE_MANIFEST_STATIC_HANDLERS/);
    assert.doesNotMatch(generated, /GUEST-CLUB_/);
  });

  it("PF-0.5 generateWorkspaceGuestConformance assigns L0/L3/L4", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceGuestConformance(manifests);
    assert.match(generated, /"denali": "L4"/);
    assert.match(generated, /"urban": "L3"/);
    assert.match(generated, /"starter": "L0"/);
  });

  it("PF-0.3 generateWorkspaceRegistrationFlowPlugins emits denali bundle and urban compose", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceRegistrationFlowPlugins(manifests);
    assert.match(generated, /denaliCatalogRegistrationFlowSurface/);
    assert.match(generated, /denaliRegistrationFlowSteps/);
    assert.match(generated, /urbanCatalogRegistrationFlowSurface/);
    assert.match(generated, /phone: CatalogRegistrationPhoneStep/);
    assert.match(generated, /intake: UrbanIntakeStep/);
    assert.match(generated, /done: UrbanDoneStep/);
    assert.doesNotMatch(generated, /"starter"/);
  });

  it("PF-0.3 compose mode rejects unknown reuse source", () => {
    assert.throws(
      () =>
        generateWorkspaceRegistrationFlowPlugins([
          {
            id: "bad",
            package: "@app-tour/workspace-bad",
            catalogRegistrationFlow: {
              surfaceExport: "badCatalogRegistrationFlowSurface",
              steps: {
                mode: "compose",
                reuseFrom: "missing",
                components: { intake: "BadIntakeStep", done: "BadDoneStep" },
              },
            },
          },
        ]),
      /reuse source unknown workspace "missing"/
    );
  });

  it("PF-1.1 generateWorkspaceCatalogListFeatures matches manifest presentation", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceCatalogListFeatures(manifests);
    assert.match(
      generated,
      /"denali": Object.freeze\(\{ cityFilter: false, serverListFilters: Object.freeze\(\["availability", "category", "difficulty", "fitness", "q", "sort"\]\) \}\)/
    );
    assert.match(
      generated,
      /"urban": Object.freeze\(\{ cityFilter: true, serverListFilters: Object.freeze\(\[\]\) \}\)/
    );
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("PF-1.1 generateWorkspaceCatalogDetailSections matches manifest presentation", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceCatalogDetailSections(manifests);
    assert.match(generated, /"denali": Object.freeze\(\{\s+difficulty: true,/);
    assert.match(generated, /"urban": Object.freeze\(\{\s+difficulty: false,/);
  });

  it("PR-0 generateWorkspaceGuestLanding matches manifest guestLanding", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceGuestLanding(manifests);
    assert.match(generated, /"denali": Object.freeze\(\{\s+variant: "full"/);
    assert.match(generated, /whySectionAnchor: "why-us"/);
    assert.match(generated, /destinationSlugs: Object.freeze\(\["alborz","damavand","zardkuh"\]\)/);
    assert.match(generated, /destinationImageStems: Object.freeze\(\{"zardkuh":"zardkooh"\}\)/);
    assert.match(generated, /latestToursLimit: 6/);
    assert.match(generated, /"urban": Object.freeze\(\{\s+variant: "minimal"/);
    assert.match(generated, /"guest-club": Object.freeze\(\{\s+variant: "minimal"/);
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("PR-0 assertGuestLandingManifest requires destinationSlugs when destinations enabled", () => {
    assert.throws(
      () =>
        assertGuestLandingManifest({
          id: "bad",
          catalogPresentation: { listFeatures: { cityFilter: false }, detailSections: {} },
          guestLanding: {
            variant: "full",
            i18nProfile: "full",
            sections: {
              hero: true,
              latestTours: true,
              latestToursLimit: 6,
              trust: true,
              finalCta: true,
              faq: true,
              footer: true,
              whySection: true,
              journey: false,
              testimonials: false,
              featuredTours: false,
              featuredToursLimit: 0,
              categories: false,
              destinations: true,
              heroSearch: false,
              gallery: false,
              equipment: false,
              blogTeaser: false,
            },
          },
        }),
      /destinationSlugs required/
    );
  });

  it("PR-0 assertGuestLandingManifest rejects minimal variant with full i18nProfile", () => {
    assert.throws(
      () =>
        assertGuestLandingManifest({
          id: "bad",
          catalogPresentation: { listFeatures: { cityFilter: false }, detailSections: {} },
          guestLanding: {
            variant: "minimal",
            i18nProfile: "full",
            sections: {
              hero: false,
              latestTours: false,
              latestToursLimit: 0,
              trust: false,
              finalCta: false,
              faq: false,
              footer: false,
              whySection: false,
              journey: false,
              testimonials: false,
              featuredTours: false,
              featuredToursLimit: 0,
              categories: false,
              destinations: false,
              heroSearch: false,
              gallery: false,
              equipment: false,
              blogTeaser: false,
            },
          },
        }),
      /minimal variant requires i18nProfile "minimal"/
    );
  });

  it("PR-0 assertGuestLandingManifest requires guestLanding when catalogPresentation exists", () => {
    assert.throws(
      () =>
        assertGuestLandingManifest({
          id: "bad",
          catalogPresentation: { listFeatures: { cityFilter: false }, detailSections: {} },
        }),
      /guestLanding is required/
    );
  });

  it("PF-1.3 generateWorkspaceDevPluginIds maps smoke tenant UUIDs", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceDevPluginIds(manifests);
    assert.match(generated, /"00000000-0000-4000-8000-000000000003": "denali"/);
    assert.match(generated, /"00000000-0000-4000-8000-000000000014": "denali"/);
    assert.match(generated, /"00000000-0000-4000-8000-000000000004": "urban"/);
  });

  it("PF-1.3 rejects duplicate tenant UUID across workspaces", () => {
    const manifests = discoverManifests();
    assert.throws(
      () =>
        generateWorkspaceDevPluginIds([
          ...manifests,
          {
            id: "dup",
            devBootstrap: {
              pluginTenantIds: ["00000000-0000-4000-8000-000000000004"],
            },
          },
        ]),
      /already mapped to "urban"/
    );
  });

  it("PF-2.1 generateWorkspaceMemberProfileCapabilities emits denali and urban rows", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceMemberProfileCapabilities(manifests);
    assert.match(generated, /"denali": Object.freeze\(\{/);
    assert.match(generated, /"nationalId","fatherName","birthDate"/);
    assert.match(generated, /"urban": Object.freeze\(\{/);
    assert.match(generated, /"displayName"/);
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("PF-2.1 rejects overlapping editable and readOnly fields", () => {
    assert.throws(
      () =>
        generateWorkspaceMemberProfileCapabilities([
          {
            id: "bad",
            memberProfile: {
              editableFields: ["displayName"],
              readOnlyFields: ["displayName"],
            },
          },
        ]),
      /cannot be both editable and readOnly/
    );
  });

  it("PF-3 guest-club trunk manifest is L3 with full guest codegen surface", () => {
    const trunk = discoverManifests();
    const guestClub = trunk.find((m) => m.id === "guest-club");
    assert.ok(guestClub, "packages/workspaces/guest-club/workspace.manifest.json must exist");
    assert.equal(resolveGuestConformanceLevel(guestClub), "L3");
    const generated = generateWorkspaceGuestConformance(trunk);
    assert.match(generated, /"guest-club": "L3"/);
    assert.match(generateWorkspaceCatalogPaths(trunk), /"guest-club": "\/guest-club\/catalog"/);
    assert.match(
      generateWorkspaceRegistrationFlowPlugins(trunk),
      /guestClubCatalogRegistrationFlowSurface/
    );

    const fixturePath = join(
      REPO_ROOT,
      "test/fixtures/workspaces/guest-club/workspace.manifest.json"
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    assert.equal(fixture.guestExtensionsVersion, guestClub.guestExtensionsVersion);
    assert.equal(fixture.httpRoutes.handlerPackage, guestClub.httpRoutes.handlerPackage);
  });

  it("Phase H3: trunk production certification — only denali certified", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceProductionCertification(manifests);
    assert.match(generated, /"denali": "certified"/);
    assert.match(generated, /"urban": "stub"/);
    assert.match(generated, /"guest-club": "stub"/);
    assert.match(generated, /"starter": "stub"/);
    for (const manifest of manifests) {
      const tier = resolveProductionCertificationTier(manifest);
      if (manifest.id === "denali") {
        assert.equal(tier, "certified");
      } else {
        assert.equal(tier, "stub");
      }
    }
  });

  it("Phase H3: drop-in fixture defaults production tier to stub", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "test/fixtures/workspaces/climbing-club/workspace.manifest.json"),
        "utf8"
      )
    );
    assert.equal(resolveProductionCertificationTier(fixture), "stub");
    const merged = [...discoverManifests(), fixture];
    const generated = generateWorkspaceProductionCertification(merged);
    assert.match(generated, /"climbing-club": "stub"/);
  });

  it("Phase I2 generateWebLoaders wires workspace-plugin-load-cache policy", () => {
    const manifests = discoverManifests();
    const generated = generateWebLoaders(manifests);
    assert.match(generated, /workspace-plugin-load-cache/);
    assert.match(generated, /getOrCreateWorkspacePluginLoad/);
    assert.match(generated, /WORKSPACE_PLUGIN_REGISTRY_REVISION/);
    assert.match(generated, /WORKSPACE_PLUGIN_LOAD_CACHE_MAX_ENTRIES = 13/);
    assert.doesNotMatch(generated, /const pluginLoadCache\s*=\s*new Map/);
  });

  it("generates a matching client-bundle guard before each gated import", () => {
    const generated = generateWebLoaders(discoverManifests());
    const denaliGuard = generated.search(/assertWorkspacePluginClientBundleEnabled\(\s*"denali"/);
    const denaliImport = generated.indexOf('import("@app-tour/workspace-denali/plugin")');
    assert.ok(denaliGuard >= 0);
    assert.ok(denaliGuard < denaliImport);
    assert.match(generated, /process\.env\.ALLOW_DENALI_WEB_PLUGIN === "true"/);
    assert.match(generated, /process\.env\.ALLOW_URBAN_WEB_PLUGIN === "true"/);
    assert.doesNotMatch(
      generated.slice(generated.indexOf('case "starter"'), generated.indexOf('case "urban"')),
      /assertWorkspacePluginClientBundleEnabled/
    );
  });
});
