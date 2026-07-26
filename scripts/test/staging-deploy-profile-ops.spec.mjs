/**
 * Thin Shell Phase 4bw — staging deploy-profile ops wiring lock (Gap Closure D.4 / D.5).
 * @see docs/dev/deploy-profile-operator-quickref.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("staging-deploy-profile-ops (Phase 4bw)", () => {
  it("TS-4BW-01 quickref documents staging env gates + scripts", () => {
    const doc = read("docs/dev/deploy-profile-operator-quickref.mdoc");
    assert.match(doc, /Phase \*\*4bw\*\*/);
    assert.match(doc, /WORKSPACE_DEPLOY_PROFILE_APPLY=1/);
    assert.match(doc, /WORKSPACE_DEPLOY_PROFILE/);
    assert.match(doc, /sync-staging-web-build\.sh/);
    assert.match(doc, /sync-staging-web-vps-build\.sh/);
    assert.match(doc, /resolve-staging-web-plugin-allow-env\.mjs/);
    assert.match(doc, /generate:workspace-registry/);
    assert.match(doc, /Never commit/);
  });

  it("TS-4BW-02 sync-staging-web-build.sh applies + restores when APPLY=1", () => {
    const sh = read("scripts/vps-deploy/sync-staging-web-build.sh");
    assert.match(sh, /WORKSPACE_DEPLOY_PROFILE_APPLY/);
    assert.match(sh, /apply:deploy-profile -- --write/);
    assert.match(sh, /resolve-staging-web-plugin-allow-env\.mjs/);
    assert.match(sh, /generate:workspace-registry/);
    assert.match(sh, /Gap Closure D\.5/);
  });

  it("TS-4BW-03 sync-staging-web-vps-build.sh applies + restores on remote when APPLY=1", () => {
    const sh = read("scripts/vps-deploy/sync-staging-web-vps-build.sh");
    assert.match(sh, /WORKSPACE_DEPLOY_PROFILE_APPLY/);
    assert.match(sh, /apply:deploy-profile -- --write/);
    assert.match(sh, /resolve-staging-web-plugin-allow-env\.mjs/);
    assert.match(sh, /generate:workspace-registry/);
  });

  it("TS-4BW-04 build-operator-vps.sh honors APPLY apply/restore", () => {
    const sh = read("scripts/vps-deploy/build-operator-vps.sh");
    assert.match(sh, /WORKSPACE_DEPLOY_PROFILE_APPLY/);
    assert.match(sh, /apply:deploy-profile -- --write/);
    assert.match(sh, /generate:workspace-registry/);
  });

  it("TS-4BW-05 remediation references Phase 4bw staging ops", () => {
    const remediation = read("docs/dev/saas-platform-remediation.mdoc");
    assert.match(remediation, /Phase 4bw/);
    assert.match(remediation, /deploy-profile-operator-quickref\.mdoc/);
    assert.match(remediation, /staging-deploy-profile-ops\.spec\.mjs/);
  });
});
