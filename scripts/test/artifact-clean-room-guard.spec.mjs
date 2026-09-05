import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const guardScript = join(repoRoot, "scripts/vps-deploy/lib/artifact-clean-room-check.sh");

function runCleanRoom(vroot, repoRootArg) {
  const script = `
    source "${guardScript}"
    artifact_clean_room_check "${vroot}" "${repoRootArg}"
  `;
  return execFileSync("bash", ["-c", script], { encoding: "utf8" });
}

function writeMinimalArtifact(root, extraBin = "") {
  mkdirSync(join(root, "api", "node_modules", ".prisma", "client"), { recursive: true });
  writeFileSync(
    join(root, "api", "node_modules", ".prisma", "client", "libquery_engine-debian-openssl-1.1.x.so.node"),
    "engine"
  );
  mkdirSync(join(root, "bin"), { recursive: true });
  writeFileSync(
    join(root, "bin", "migrate-deploy.sh"),
    '#!/usr/bin/env bash\ncd "${RELEASE_ROOT}/api"\n'
  );
  mkdirSync(join(root, "prisma-migrate", "node_modules", "prisma", "build"), { recursive: true });
  writeFileSync(join(root, "prisma-migrate", "node_modules", "prisma", "build", "index.js"), "module.exports = {};\n");
  if (extraBin) {
    writeFileSync(join(root, "bin", "seed-staging.cjs"), extraBin);
  }
}

describe("artifact-clean-room-guard", () => {
  it("ACR-01 allows workspace route strings when repo root is /workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "acr-"));
    writeMinimalArtifact(root, 'const route = "/workspace-harbor/host/tours";\n');
    const output = runCleanRoom(root, "/workspace");
    assert.match(output, /artifact-clean-room: OK/);
  });

  it("ACR-02 rejects literal build-host path under repo root", () => {
    const root = mkdtempSync(join(tmpdir(), "acr-"));
    writeMinimalArtifact(root, 'const leaked = "/workspace/packages/workspaces/denali/dist/index.js";\n');
    let failed = false;
    try {
      runCleanRoom(root, "/workspace");
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
  });
});
