/**
 * PF-3 — workspace:create --guest emits an L3 guest scaffold without core edits.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  generateWorkspaceCatalogDetailSections,
  generateWorkspaceCatalogListFeatures,
  generateWorkspaceCatalogPaths,
  generateWorkspaceDevPluginIds,
  generateWorkspaceGuestConformance,
  generateWorkspaceMemberProfileCapabilities,
  generateWorkspaceRegistrationFlowPlugins,
  resolveGuestConformanceLevel,
} from "../generate-workspace-registry.mjs";
import { scaffoldWorkspace } from "../workspace-create.mjs";

function withTempRepo(fn) {
  const repoRoot = mkdtempSync(join(tmpdir(), "workspace-create-guest-"));
  try {
    return fn(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("workspace:create --guest", () => {
  it("scaffolds an L3 guest-ready workspace manifest and codegen imports", () =>
    withTempRepo((repoRoot) => {
      const { dir } = scaffoldWorkspace({ repoRoot, id: "alpine-club", guest: true });
      const manifest = JSON.parse(readFileSync(join(dir, "workspace.manifest.json"), "utf8"));

      assert.equal(manifest.guestExtensionsVersion, 1);
      assert.deepEqual(manifest.guestConformance, { productionTier: "stub" });
      assert.equal(manifest.httpRoutes.loadHandlersFromPackage, true);
      assert.equal(resolveGuestConformanceLevel(manifest), "L3");
      assert.deepEqual(manifest.catalogRegistrationFlow.steps, {
        mode: "compose",
        reuseAuthStepsFrom: "shared",
        components: { intake: "AlpineClubIntakeStep", done: "AlpineClubDoneStep" },
      });
      assert.deepEqual(manifest.memberProfile.editableFields, ["displayName"]);
      assert.deepEqual(manifest.memberProfile.readOnlyFields, ["email"]);
      assert.deepEqual(manifest.operatorCapabilities, {
        usersDirectory: false,
        reconciliationTriage: false,
        fieldExposureSurfaces: false,
      });
      assert.equal(manifest.httpRoutes.handlerPackage, "@app-tour/workspace-alpine-club/http");

      assert.ok(existsSync(join(dir, "src/catalog/registration-flow/registration-flow.steps.tsx")));
      assert.ok(existsSync(join(dir, "src/http/routes.ts")));
      assert.ok(existsSync(join(dir, "theme/marketing.css")));
      assert.ok(existsSync(join(dir, "design-language/MASTER.md")));

      assert.ok(existsSync(join(dir, "src/catalog/alpine-club-smoke-catalog.fixture.ts")));
      assert.ok(existsSync(join(dir, "src/http/alpine-club-catalog-http.ts")));
      const catalogHttpTs = readFileSync(join(dir, "src/http/alpine-club-catalog-http.ts"), "utf8");
      assert.match(catalogHttpTs, /createWorkspaceGuestSmokeHttpHandlers/);
      assert.match(catalogHttpTs, /ALPINE_CLUB_SMOKE_E2E_SEED/);
      assert.doesNotMatch(catalogHttpTs, /sendWorkspaceGuestStub/);
      const routesTs = readFileSync(join(dir, "src/http/routes.ts"), "utf8");
      assert.match(routesTs, /alpine-club-catalog-http/);
      assert.doesNotMatch(routesTs, /from "\.\/alpine-club-catalog-http\.ts"/);
      assert.doesNotMatch(routesTs, /function sendGuestStub/);
      const routesManifestTs = readFileSync(join(dir, "src/http/routes-manifest.ts"), "utf8");
      assert.match(routesManifestTs, /WorkspaceHttpMethod/);
      const catalogIndexTs = readFileSync(join(dir, "src/catalog/index.ts"), "utf8");
      assert.match(catalogIndexTs, /buildAlpineClubSmokeCatalogCard/);
      assert.doesNotMatch(catalogIndexTs, /from "\.\/.*\.ts"/);
      assert.doesNotMatch(catalogHttpTs, /from "\.\.\/catalog\/.*\.ts"/);

      assert.ok(existsSync(join(dir, "test/guest-smoke-http.spec.ts")));
      assert.ok(existsSync(join(dir, "test/guest-clone-budget.spec.ts")));
      const smokeHttpSpec = readFileSync(join(dir, "test/guest-smoke-http.spec.ts"), "utf8");
      assert.match(smokeHttpSpec, /ALPINE_CLUB_SMOKE_E2E_SEED/);
      assert.match(smokeHttpSpec, /WORKSPACE_GUEST_STUB/);
      assert.match(smokeHttpSpec, /handleGetAlpineClubCatalog/);
      const cloneBudgetSpec = readFileSync(join(dir, "test/guest-clone-budget.spec.ts"), "utf8");
      assert.match(cloneBudgetSpec, /workspace-denali/);
      assert.match(cloneBudgetSpec, /httpFiles\.length <= 6/);

      const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      assert.ok(packageJson.exports["./host/catalog-registration-flow"]);
      assert.ok(packageJson.exports["./host/catalog-registration-flow/react"]);
      assert.ok(packageJson.exports["./host/http"]);
      assert.ok(packageJson.exports["./theme/marketing.css"]);
      assert.equal(packageJson.exports["./alpine-club.plugin"], undefined);
      assert.equal(packageJson.exports["./catalog"], undefined);
      assert.equal(packageJson.exports["./http"], undefined);

      assert.match(generateWorkspaceCatalogPaths([manifest]), /"alpine-club": "\/alpine-club\/catalog"/);
      assert.match(
        generateWorkspaceRegistrationFlowPlugins([manifest]),
        /alpineClubCatalogRegistrationFlowSurface/
      );
      assert.match(generateWorkspaceCatalogListFeatures([manifest]), /"alpine-club"/);
      assert.match(generateWorkspaceCatalogDetailSections([manifest]), /"alpine-club"/);
      assert.deepEqual(manifest.guestLanding, {
        variant: "minimal",
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
        i18nProfile: "minimal",
      });
      assert.equal(manifest.guestSeo.marketing.homeTitleKey, "seo.homeTitle");
      assert.equal(manifest.guestSeo.marketing.homeDescriptionKey, "seo.homeDescription");
      assert.match(generateWorkspaceDevPluginIds([manifest]), /"alpine-club"/);
      assert.match(generateWorkspaceMemberProfileCapabilities([manifest]), /"alpine-club"/);
      assert.match(generateWorkspaceGuestConformance([manifest]), /"alpine-club": "L3"/);
    }));
});
