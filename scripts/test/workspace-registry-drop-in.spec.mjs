/**
 * P7-T06 — drop-in workspace manifest fixture validates without trunk package dir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertPackageWebModule,
  discoverManifests,
  generateDevBootstrapBindings,
  generateOutboxSideEffects,
  generateSdkBindings,
  generateSettingsEnrichers,
  generateWizardMediaBackendRouteBindings,
  generateWizardMediaRouteBindings,
  generateWorkspaceThemeStylesheets,
} from "../generate-workspace-registry.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_MANIFEST = join(
  REPO_ROOT,
  "test/fixtures/workspaces/climbing-club/workspace.manifest.json"
);

describe("workspace registry drop-in (P7-T06)", () => {
  it("trunk manifests discover starter, denali, urban", () => {
    const manifests = discoverManifests();
    const ids = manifests.map((m) => m.id).sort();
    assert.deepEqual(ids, ["denali", "starter", "urban"]);
  });

  it("climbing-club fixture merges into generated bindings without packages/workspaces/climbing-club", () => {
    const trunk = discoverManifests();
    const fixture = JSON.parse(readFileSync(FIXTURE_MANIFEST, "utf8"));
    const merged = [...trunk, fixture].sort((a, b) => a.id.localeCompare(b.id));
    const sdk = generateSdkBindings(merged);
    assert.match(sdk, /workspaceType: "climbing-club"/);
    assert.match(sdk, /pluginId: "climbing-club"/);
    assert.equal(
      merged.find((m) => m.id === "climbing-club")?.workspaceTypes[0],
      "climbing-club"
    );
  });

  it("P15-W-B5 generateWorkspaceThemeStylesheets imports manifest theme CSS", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceThemeStylesheets(manifests);
    assert.match(generated, /@app-tour\/workspace-denali\/theme\/denali-admin\.css/);
    assert.match(generated, /@app-tour\/workspace-starter\/theme\/tokens\.css/);
    assert.match(generated, /@app-tour\/workspace-urban\/theme\/tokens\.css/);
    assert.throws(
      () =>
        generateWorkspaceThemeStylesheets([
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
    assert.match(generated, /"wizard-photos": "\/api\/tours\/wizard-photos"/);
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

  it("P0-PR-1 generateOutboxSideEffects imports manifest hostSideEffect adapter", () => {
    const manifests = discoverManifests();
    const generated = generateOutboxSideEffects(manifests);
    assert.match(
      generated,
      /@app-tour\/workspace-denali\/finance\/api-tour-created-adapter/
    );
    assert.match(generated, /runTourCreatedFinanceSideEffect/);
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
  });

  it("P0-PR-1 generateSettingsEnrichers maps denali tour_themes and equipment", () => {
    const manifests = discoverManifests();
    const generated = generateSettingsEnrichers(manifests);
    assert.match(generated, /resolveThemeCompatibleCategories/);
    assert.match(generated, /resolveEquipmentCompatibleCategories/);
    assert.match(generated, /enrichSettingsModuleList/);
    assert.match(generated, /settingsModuleId: "tour_themes"/);
    assert.match(generated, /settingsModuleId: "equipment"/);
  });

  it("P0-PR-1 generateDevBootstrapBindings emits denali and urban wizard templates", () => {
    const manifests = discoverManifests();
    const generated = generateDevBootstrapBindings(manifests);
    assert.match(generated, /buildDenaliFullWizardTemplatePayload/);
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
});
