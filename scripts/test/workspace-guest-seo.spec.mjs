/**
 * SEO-2 — dual verify guest SEO generator vs manifest admission.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertGuestSeoManifest,
  discoverManifests,
  generateWorkspaceGuestSeo,
  resolveGuestConformanceLevel,
} from "../generate-workspace-registry.mjs";
import { buildGuestManifestObject } from "../workspace-create.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/catalog/workspace-guest-seo.generated.ts"
);
const GOLDEN = join(REPO_ROOT, "scripts/test/fixtures/workspace-guest-seo.golden.json");

describe("workspace guest SEO dual verify (SEO-2)", () => {
  it("trunk L2+ manifests declare guestSeo and generated file matches generator", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceGuestSeo(manifests);
    const onDisk = readFileSync(GENERATED, "utf8");
    assert.equal(generated, onDisk);

    for (const manifest of manifests) {
      const level = resolveGuestConformanceLevel(manifest);
      if (level === "L0" || level === "L1") {
        continue;
      }
      assert.notEqual(manifest.guestSeo, undefined, `${manifest.id} must declare guestSeo`);
      assert.doesNotThrow(() => assertGuestSeoManifest(manifest));
      assert.match(generated, new RegExp(`"${manifest.id}":`));
      assert.match(
        generated,
        new RegExp(manifest.guestSeo.marketing.jsonLd.builderExport)
      );
    }
  });

  it("guest scaffold manifest includes guestSeo stub for guard admission", () => {
    const guestManifest = buildGuestManifestObject("guest-seo-scaffold");
    assert.doesNotThrow(() => assertGuestSeoManifest(guestManifest));
    const generated = generateWorkspaceGuestSeo([guestManifest]);
    assert.match(generated, /"guest-seo-scaffold":/);
    assert.match(generated, /buildGuestSeoScaffoldEventJsonLd/);
  });

  it("trunk SEO profiles match golden fixtures", () => {
    const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
    const manifests = discoverManifests();

    for (const manifest of manifests) {
      if (manifest.guestSeo === undefined) {
        continue;
      }
      const expected = golden[manifest.id];
      assert.notEqual(expected, undefined, `${manifest.id} missing guest SEO golden fixture`);
      const jsonLd = manifest.guestSeo.marketing.jsonLd;
      assert.deepEqual(jsonLd.schemaTypes, expected.schemaTypes);
      assert.equal(jsonLd.builderExport, expected.builderExport);
      assert.equal(jsonLd.richResultsProfile, expected.richResultsProfile);
      assert.deepEqual(
        manifest.guestSeo.marketing.pagination?.noindexQueryParams ?? [],
        expected.noindexQueryParams
      );
    }
  });
});
