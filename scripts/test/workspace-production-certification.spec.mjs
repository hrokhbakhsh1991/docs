/**
 * Phase H1 — dual verify production certification generator vs manifest logic.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertGuestExtensionsManifest,
  discoverManifests,
  generateWorkspaceProductionCertification,
  resolveProductionCertificationTier,
} from "../generate-workspace-registry.mjs";
import { buildGuestManifestObject } from "../workspace-create.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/catalog/workspace-production-certification.generated.ts"
);

describe("workspace production certification (Phase H1)", () => {
  it("trunk manifests match resolveProductionCertificationTier and generated file", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceProductionCertification(manifests);
    const onDisk = readFileSync(GENERATED, "utf8");
    assert.equal(generated, onDisk);

    for (const manifest of manifests) {
      const tier = resolveProductionCertificationTier(manifest);
      assert.match(generated, new RegExp(`"${manifest.id}": "${tier}"`));
    }
  });

  it("defaults guest-capable manifests to stub when productionTier omitted", () => {
    const guestManifest = buildGuestManifestObject("alpine-club");
    delete guestManifest.guestConformance;
    assert.doesNotThrow(() => assertGuestExtensionsManifest(guestManifest));
    assert.equal(resolveProductionCertificationTier(guestManifest), "stub");
  });

  it("rejects certified starter", () => {
    assert.throws(
      () =>
        resolveProductionCertificationTier({
          id: "starter",
          guestConformance: { productionTier: "certified" },
        }),
      /WORKSPACE_STARTER_NOT_CERTIFIABLE/
    );
  });

  it("rejects certified below L3", () => {
    assert.throws(
      () =>
        resolveProductionCertificationTier({
          id: "bad",
          guestExtensionsVersion: 1,
          guestConformance: { productionTier: "certified" },
          httpRoutes: {
            handlerPackage: "@app-tour/workspace-bad/http",
            groups: [
              {
                manifestExport: "BAD_HTTP_ROUTE_MANIFEST",
                staticHandlers: { "GET /bad/catalog": "handleGetBadCatalog" },
              },
            ],
          },
        }),
      /WORKSPACE_CERTIFICATION_L3_REQUIRED/
    );
  });
});
