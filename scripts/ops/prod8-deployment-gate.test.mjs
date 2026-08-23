import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const deploy = readFileSync(".github/workflows/deploy-vps.yml", "utf8");
const prod8 = readFileSync(".github/workflows/prod-8-deployment-gate.yml", "utf8");

assert.doesNotMatch(deploy, /push:\s*\n\s*branches:\s*\n\s*-\s*main/, "main push deploy forbidden");
assert.match(deploy, /workflow_dispatch/, "deploy must be manual/RC gated");
assert.match(deploy, /prod8-validate-rc-ref\.mjs/, "RC tag policy enforced");
assert.match(deploy, /environment:\s*production/, "production environment approval required");
assert.match(deploy, /release:verify/, "L3 eligibility required");
assert.match(prod8, /prod8:deployment-gate/, "prod-8 gate workflow wired");

console.log("prod8-deployment-gate.test: PASS");
