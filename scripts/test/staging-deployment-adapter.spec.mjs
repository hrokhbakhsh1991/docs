import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const adapter = fileURLToPath(new URL("../ci/staging-deployment-adapter.sh", import.meta.url));

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "staging-adapter-"));
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const name = `app-tour-staging-${sha}`;
  const artifactRoot = join(dir, name);
  execFileSync("mkdir", ["-p", artifactRoot]);
  writeFileSync(join(artifactRoot, "release-manifest.json"), JSON.stringify({ releaseSha: sha }));
  const tar = join(dir, `${name}.tar`);
  const artifact = join(dir, `${name}.tar.zst`);
  execFileSync("tar", ["-C", dir, "-cf", tar, name]);
  execFileSync("zstd", ["-q", "-f", tar, "-o", artifact]);
  const digest = execFileSync("sha256sum", [artifact], { encoding: "utf8" }).split(/\s/)[0];
  return { artifact, digest, sha };
}

function run(extra = {}) {
  const f = fixture();
  const result = (() => {
    try {
      return { status: 0, stdout: execFileSync(adapter, ["verify-staging"], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REF: "refs/heads/dev",
          DEPLOY_TARGET: "staging",
          STAGING_DEPLOY_ROOT: "/opt/app-tour-staging",
          STAGING_ENV_DIR: "/etc/app-tour-staging",
          STAGING_TENANT_SCOPE: "pilot-only",
          STAGING_ARTIFACT: f.artifact,
          STAGING_ARTIFACT_DIGEST: f.digest,
          STAGING_RELEASE_SHA: f.sha,
          STAGING_ADAPTER_DRY_RUN: "1",
          ...extra,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }), stderr: "" };
    } catch (error) {
      return { status: error.status, stdout: error.stdout?.toString() ?? "", stderr: error.stderr?.toString() ?? "" };
    }
  })();
  return { ...f, ...result };
}

test("valid staging artifact passes isolated dry-run", () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /STAGING_ADAPTER_DRY_RUN_OK/);
});

test("production target is rejected", () => {
  assert.notEqual(run({ DEPLOY_TARGET: "production" }).status, 0);
});

test("missing or invalid digest is rejected", () => {
  assert.notEqual(run({ STAGING_ARTIFACT_DIGEST: "" }).status, 0);
  assert.notEqual(run({ STAGING_ARTIFACT_DIGEST: "a".repeat(64) }).status, 0);
});

test("non-pilot and bulk tenant scopes are rejected", () => {
  assert.notEqual(run({ STAGING_TENANT_SCOPE: "all" }).status, 0);
  assert.notEqual(run({ BULK_TENANT_ENABLEMENT: "1" }).status, 0);
});

test("secret values never appear in adapter output", () => {
  const secret = "do-not-print-this-secret";
  const result = run({ VPS_SSH_KEY: secret, DATABASE_URL: secret, VPS_HOST: secret });
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret));
});
