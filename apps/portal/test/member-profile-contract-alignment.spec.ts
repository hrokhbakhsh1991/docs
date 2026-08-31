import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("member-profile-contract-alignment.spec.ts", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("MP-SNAPSHOT-01 resolves sibling snapshot in dev src layout", async () => {
    const { resolveMemberProfileContractSnapshotPath } = await import(
      "../src/me/member-profile-contract-alignment.server"
    );
    const resolved = resolveMemberProfileContractSnapshotPath();
    assert.equal(existsSync(resolved), true);
    assert.match(resolved, /member-profile-contract-v1\.snapshot\.json$/);
  });

  it("MP-SNAPSHOT-03 resolves snapshot under Next standalone cwd (apps/portal chdir)", async () => {
    const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const standaloneCwd = portalRoot;
    const snapshotSrc = join(standaloneCwd, "src/me/member-profile-contract-v1.snapshot.json");
    assert.equal(existsSync(snapshotSrc), true);

    const previousCwd = process.cwd();
    process.chdir(standaloneCwd);
    try {
      const { resolveMemberProfileContractSnapshotPath } = await import(
        "../src/me/member-profile-contract-alignment.server"
      );
      assert.equal(resolveMemberProfileContractSnapshotPath(), snapshotSrc);
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("MP-SNAPSHOT-02 MEMBER_PROFILE_CONTRACT_SNAPSHOT_PATH env override", async () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const tmpDir = join(repoRoot, ".artifact-test-snapshot-override");
    mkdirSync(tmpDir, { recursive: true });
    const snapshotPath = join(tmpDir, "member-profile-contract-v1.snapshot.json");
    writeFileSync(
      snapshotPath,
      JSON.stringify({ contractVersion: "v1", memberProfileFieldIds: [] })
    );
    process.env.MEMBER_PROFILE_CONTRACT_SNAPSHOT_PATH = snapshotPath;

    const { resolveMemberProfileContractSnapshotPath } = await import(
      "../src/me/member-profile-contract-alignment.server"
    );
    assert.equal(resolveMemberProfileContractSnapshotPath(), snapshotPath);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
