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

test("staging builds the dependency chain before focused tests", () => {
  const build = workflow.indexOf("bash scripts/ci/build-api-workspace-deps.sh");
  const tests = workflow.indexOf("pnpm run test:changed");
  assert.ok(build >= 0 && tests > build);
});
