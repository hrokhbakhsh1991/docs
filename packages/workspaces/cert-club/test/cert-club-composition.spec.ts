import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

describe("cert-club capability composition (CW9-03)", () => {
  it("CW9-03-01 profile expands finance+booking from starter-outdoor", () => {
    const snapshot = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-club/profile.expanded.snapshot.json"),
        "utf8"
      )
    );
    assert.equal(snapshot.workspaceBooking?.supported, true);
    assert.equal(snapshot.workspaceFinance?.supported, true);
  });

  it("CW9-03-02 author manifest enables equipment+transport runtime bindings", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-club/workspace.manifest.json"),
        "utf8"
      )
    );
    assert.equal(manifest.workspaceEquipment?.supported, true);
    assert.equal(manifest.workspaceTransport?.supported, true);
    assert.equal(manifest.workspacePolicy?.export, "createCertClubTourWorkspacePolicyValidator");
  });

  it("CW9-03-03 codegen projects equipment+transport for cert-club", async () => {
    const equipment = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspace-sdk/src/catalog/workspace-equipment-capabilities.generated.ts"
      ),
      "utf8"
    );
    const transport = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspace-sdk/src/catalog/workspace-transport-capabilities.generated.ts"
      ),
      "utf8"
    );
    const readers = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspace-sdk/src/catalog/catalog-transport-snapshot-readers.generated.ts"
      ),
      "utf8"
    );
    assert.match(equipment, /"cert-club":/);
    assert.match(transport, /"cert-club":/);
    assert.match(readers, /cert-club/);
    assert.match(readers, /resolveCatalogTransportSnapshotReader/);
    assert.match(readers, /readCertClubCatalogTransportSnapshot/);
  });

  it("CW9-03-04 stub-tier author override documents finance/booking without tourWrite", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-club/workspace.manifest.json"),
        "utf8"
      )
    );
    assert.equal(manifest.guestConformance?.productionTier, "stub");
    assert.equal(manifest.workspaceFinance?.supported, false);
    assert.equal(manifest.workspaceBooking?.supported, false);
    assert.equal(manifest.tourWrite, undefined);
  });
});
