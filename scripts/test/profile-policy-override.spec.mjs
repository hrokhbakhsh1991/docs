/**
 * CW6-05B — profile + workspacePolicy join proof (CW8-03 seam).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  expandAuthorManifest,
  loadProfileCatalog,
} from "../codegen/workspace-registry/domains/profile-expansion.mjs";

const MANIFEST_PATH = join(process.cwd(), "scripts/test/fixtures/profile-cert.manifest.json");

describe("profile-policy override (CW6-05B)", () => {
  it("preserves author workspacePolicy after starter-outdoor profile expansion", () => {
    const author = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    assert.equal(author.profile, "starter-outdoor");
    assert.equal(author.workspacePolicy?.module, "./policy/tour-policy");
    assert.equal(author.workspacePolicy?.export, "createTourWorkspacePolicyValidator");

    const catalog = loadProfileCatalog();
    const { effective, audit } = expandAuthorManifest(author, catalog);

    assert.equal(audit?.profileId, "starter-outdoor");
    assert.ok(audit?.overriddenPaths?.includes("workspacePolicy"));
    assert.equal(effective.workspacePolicy?.module, "./policy/tour-policy");
    assert.equal(effective.workspacePolicy?.export, "createTourWorkspacePolicyValidator");
    assert.equal(effective.profile, undefined);
    assert.equal(effective.workspaceBooking?.supported, true);
    assert.equal(effective.workspaceFinance?.supported, true);
  });

  it("profile catalog forbids workspacePolicy in capabilityDefaults", () => {
    const catalog = loadProfileCatalog();
    const starterOutdoor = catalog.get("starter-outdoor");
    assert.ok(starterOutdoor);
    assert.equal(starterOutdoor.capabilityDefaults.workspacePolicy, undefined);
  });
});
