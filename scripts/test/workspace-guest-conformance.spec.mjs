/**
 * PF-0.5.2 — dual verify guest conformance generator vs manifest logic.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assertGuestExtensionsManifest,
  discoverManifests,
  generateWorkspaceGuestConformance,
  resolveGuestConformanceLevel,
} from "../generate-workspace-registry.mjs";
import { buildGuestManifestObject } from "../workspace-create.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GENERATED = join(
  REPO_ROOT,
  "packages/workspace-sdk/src/catalog/workspace-guest-conformance.generated.ts"
);

describe("workspace guest conformance dual verify (PF-0.5.2)", () => {
  it("trunk manifests match resolveGuestConformanceLevel and generated file", () => {
    const manifests = discoverManifests();
    const generated = generateWorkspaceGuestConformance(manifests);
    const onDisk = readFileSync(GENERATED, "utf8");
    assert.equal(generated, onDisk);

    for (const manifest of manifests) {
      const level = resolveGuestConformanceLevel(manifest);
      assert.match(generated, new RegExp(`"${manifest.id}": "${level}"`));
    }
  });

  it("guest scaffold manifest resolves to L3 in generator output", () => {
    const guestManifest = buildGuestManifestObject("guest-club");
    assert.doesNotThrow(() => assertGuestExtensionsManifest(guestManifest));
    assert.equal(resolveGuestConformanceLevel(guestManifest), "L3");
    const generated = generateWorkspaceGuestConformance([guestManifest]);
    assert.match(generated, /"guest-club": "L3"/);
  });

  it("denali reference manifest resolves to L4 when memberPortal present", () => {
    const manifests = discoverManifests();
    const denali = manifests.find((manifest) => manifest.id === "denali");
    assert.ok(denali);
    assert.equal(resolveGuestConformanceLevel(denali), "L4");
    const generated = generateWorkspaceGuestConformance(manifests);
    assert.match(generated, /"denali": "L4"/);
  });

  it("guest-capable manifests require guestExtensionsVersion: 1", () => {
    const bad = buildGuestManifestObject("bad-guest");
    delete bad.guestExtensionsVersion;
    assert.throws(
      () => assertGuestExtensionsManifest(bad),
      /guestExtensionsVersion: 1 is required/
    );
  });
});
