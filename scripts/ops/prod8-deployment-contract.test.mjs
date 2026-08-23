import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateRcRef } from "./prod8-validate-rc-ref.mjs";

const deploy = readFileSync(".github/workflows/deploy-vps.yml", "utf8");
const immutableDeploy = readFileSync("scripts/vps-deploy/deploy-immutable-release.sh", "utf8");
const systemd = readFileSync("scripts/vps-deploy/install-systemd-units.sh", "utf8");
const gate = readFileSync("scripts/ops/prod8-deployment-gate.mjs", "utf8");
const bundle = readFileSync("scripts/ops/prod8-build-immutable-bundle.mjs", "utf8");

assert.doesNotMatch(deploy, /push:\s*\n\s*branches:\s*\n\s*-\s*main/);
assert.match(deploy, /prod8-validate-rc-ref\.mjs/);
assert.match(deploy, /environment:\s*production/);
assert.match(deploy, /needs:\s*\[resolve-release,\s*l3-eligibility\]/);
assert.match(deploy, /release:verify/);

assert.doesNotMatch(
  immutableDeploy.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"),
  /\bpnpm\s+install\b/,
);
assert.doesNotMatch(
  immutableDeploy.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"),
  /build-operator-vps/,
);
assert.match(immutableDeploy, /pre-migrate-pg-dump\.sh/);
assert.match(immutableDeploy, /die "pre-migrate dump failed"/);
assert.doesNotMatch(immutableDeploy, /rollback-vps\.sh.*\|\|\s*true/s);
assert.match(immutableDeploy, /automatic rollback failed — incident procedure INC-02/);

assert.match(systemd, /CURRENT_LINK/);
assert.match(systemd, /DEPLOY_PATH="\$CURRENT_LINK"/);

assert.match(bundle, /same_digest_staging_production_verified: "NOT_YET_VERIFIED"/);
assert.doesNotMatch(bundle, /same_digest_staging_production:\s*true/);

assert.match(gate, /TOOLING_PASS_EXTERNAL_VERIFICATION_PENDING/);
assert.match(gate, /blocks_production_acceptance/);

const badSha = validateRcRef("main");
assert.equal(badSha.ok, false);

const tag = spawnSync("git", ["tag", "-f", "rc-prod8-contract-test", "HEAD"], { encoding: "utf8" });
assert.equal(tag.status, 0);
const good = validateRcRef("rc-prod8-contract-test");
assert.equal(good.ok, true);
spawnSync("git", ["tag", "-d", "rc-prod8-contract-test"], { encoding: "utf8" });

console.log("prod8-deployment-contract.test: PASS");
