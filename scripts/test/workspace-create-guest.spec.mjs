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
      assert.equal(manifest.httpRoutes.loadHandlersFromPackage, true);
      assert.equal(resolveGuestConformanceLevel(manifest), "L3");
      assert.deepEqual(manifest.catalogRegistrationFlow.steps, {
        mode: "compose",
        reuseAuthStepsFrom: "shared",
        components: { intake: "AlpineClubIntakeStep", done: "AlpineClubDoneStep" },
      });
      assert.deepEqual(manifest.memberProfile.editableFields, ["displayName"]);
      assert.deepEqual(manifest.memberProfile.readOnlyFields, ["email"]);
      assert.equal(manifest.httpRoutes.handlerPackage, "@app-tour/workspace-alpine-club/http");

      assert.ok(existsSync(join(dir, "src/catalog/registration-flow/registration-flow.steps.tsx")));
      assert.ok(existsSync(join(dir, "src/http/routes.ts")));
      assert.ok(existsSync(join(dir, "theme/marketing.css")));
      assert.ok(existsSync(join(dir, "design-language/MASTER.md")));

      const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      assert.ok(packageJson.exports["./catalog-registration-flow"]);
      assert.ok(packageJson.exports["./catalog-registration-flow/react"]);
      assert.ok(packageJson.exports["./http"]);
      assert.ok(packageJson.exports["./theme/marketing.css"]);

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
          whyDenali: false,
          journey: false,
          testimonials: false,
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
