import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

describe("cert-club policy (CW9-03)", () => {
  it("CW9-03-01 manifest declares workspacePolicy seam", async () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-club/workspace.manifest.json"),
        "utf8"
      )
    );
    assert.equal(manifest.workspacePolicy?.export, "createCertClubTourWorkspacePolicyValidator");
    assert.equal(manifest.workspaceEquipment?.supported, true);
    assert.equal(manifest.workspaceTransport?.supported, true);
    assert.equal(manifest.workspaceFinance?.supported, false);
    assert.equal(manifest.workspaceBooking?.supported, false);
  });

  it("CW9-03-02 policy validator runs two ordered rules", async () => {
    const { createCertClubTourWorkspacePolicyValidator } = await import(
      "../src/policy/tour-policy.ts"
    );
    const validator = createCertClubTourWorkspacePolicyValidator();
    const short = validator.validate({
      document: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "ab" }, details: {} },
      },
      workspaceType: "cert-club",
      tenantId: "cert-club-policy-test",
    });
    assert.equal(short?.code, "CERT_CLUB_TITLE_TOO_SHORT");

    const blocked = validator.validate({
      document: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "forbidden tour" }, details: {} },
      },
      workspaceType: "cert-club",
      tenantId: "cert-club-policy-test",
    });
    assert.equal(blocked?.code, "CERT_CLUB_BLOCKED_WORD");
  });
});
