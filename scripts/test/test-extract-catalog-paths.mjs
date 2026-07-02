/**
 * PF-0.1.4 — extractCatalogPathsFromManifest unit guard.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  discoverManifests,
  extractCatalogPathsFromManifest,
  generateWorkspaceCatalogPaths,
} from "../generate-workspace-registry.mjs";

describe("extractCatalogPathsFromManifest (PF-0.1.4)", () => {
  it("resolves denali and urban catalog list paths from trunk manifests", () => {
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

  it("generateWorkspaceCatalogPaths emits manifest-derived map", () => {
    const generated = generateWorkspaceCatalogPaths(discoverManifests());
    assert.match(generated, /"denali": "\/denali\/catalog"/);
    assert.match(generated, /"urban": "\/urban\/catalog"/);
    assert.doesNotMatch(generated, /"starter":/);
  });

  it("guestCatalog.enabled without routes throws", () => {
    assert.throws(
      () =>
        generateWorkspaceCatalogPaths([
          {
            id: "bad",
            guestCatalog: { enabled: true },
          },
        ]),
      /guestCatalog\.enabled requires catalog httpRoutes/
    );
  });
});
