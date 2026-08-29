import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("staging artifact resumable transfer", () => {
  const deploy = read("scripts/vps-deploy/deploy-staging-artifact-remote.sh");
  const ssh = read("scripts/vps-deploy/lib/staging-ssh.sh");

  it("uses deterministic 8MiB chunks by default", () => {
    assert.match(deploy, /STAGING_ARTIFACT_CHUNK_SIZE:-8m/);
    assert.match(deploy, /split -d -a 5 -b "\$chunk_size"/);
  });

  it("keys remote chunk directories by artifact checksum", () => {
    assert.match(deploy, /\/tmp\/app-tour-artifacts\/\$\{BASENAME\}\.\$\{EXPECTED_SHA\}\.parts/);
  });

  it("skips already verified remote chunks", () => {
    assert.match(deploy, /existing_sha="\$\(remote_sha_for "\$remote_part"\)"/);
    assert.match(deploy, /chunk \$\{name\} already verified; skip/);
  });

  it("uploads chunks through a temporary name and verifies sha before promoting", () => {
    assert.match(deploy, /tmp_part="\$\{remote_part\}\.uploading"/);
    assert.match(deploy, /uploaded_sha="\$\(remote_sha_for "\$tmp_part"\)"/);
    assert.match(deploy, /mv \$\{tmp_part_q\} \$\{remote_part_q\}/);
  });

  it("bounds chunk retry attempts and probes ssh before retry", () => {
    assert.match(deploy, /for attempt in 1 2 3/);
    assert.match(deploy, /chunk \$\{name\} failed after 3 attempts/);
    assert.match(deploy, /SSH_RETRY_OK/);
  });

  it("assembles only after chunk verification and uses atomic final rename", () => {
    assert.match(deploy, /\$\{remote_artifact\}\.assembling/);
    assert.match(deploy, /assembled checksum mismatch/);
    assert.match(deploy, /mv \$\{assembling_q\} \$\{remote_artifact_q\}/);
  });

  it("supports transfer-only diagnostics without running installer", () => {
    assert.match(deploy, /STAGING_ARTIFACT_TRANSFER_ONLY/);
    assert.match(deploy, /TRANSFER_ONLY_OK/);
  });

  it("keeps bounded ssh keepalive options for long transfers", () => {
    assert.match(ssh, /ServerAliveInterval=15/);
    assert.match(ssh, /ServerAliveCountMax=4/);
  });
});
