import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const buildOrder = read("scripts/ci/build-api-workspace-deps.sh");
const workflow = read(".github/workflows/deploy-staging.yml");

test("build order materializes workspace-sdk runtime dependencies", () => {
  const packages = [
    "catalog-registration-auth",
    "booking-http-contracts",
    "tour-core",
    "workspace-sdk",
  ];
  const positions = packages.map((name) => {
    const position = buildOrder.indexOf(`pnpm --dir packages/${name} run build`);
    assert.notEqual(position, -1, `${name} missing from dependency build order`);
    return position;
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("staging exposes bounded focused test stages without broad globs", () => {
  for (const stage of [
    "Build workspace dependency artifacts",
    "Wallet and API focused tests",
    "Workspace SDK focused tests",
    "Other changed tests",
  ]) {
    assert.match(workflow, new RegExp(`name: ${stage}`));
  }
  assert.doesNotMatch(workflow, /pnpm run test:changed/);
  assert.doesNotMatch(workflow, /test:\/\*\//);
});

test("staging bounds each focused stage independently", () => {
  assert.match(workflow, /timeout[^\n]+10m bash scripts\/ci\/build-api-workspace-deps\.sh/);
  assert.match(workflow, /timeout[^\n]+5m pnpm run test:wallet-staging-deploy-guards/);
  assert.match(workflow, /timeout[^\n]+10m bash -c 'cd packages\/workspace-sdk/);
  assert.match(workflow, /timeout[^\n]+5m node --test scripts\/test\/deployment-branch-contract\.spec\.mjs/);
});
