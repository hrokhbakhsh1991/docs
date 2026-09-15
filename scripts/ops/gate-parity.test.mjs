import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const catalog = JSON.parse(readFileSync("docs/platform/PROD-3-GATE-CATALOG.json", "utf8"));
const docs = readFileSync("docs/platform/PROD-3-GATE-MODEL.md", "utf8");
const workflow = readFileSync(".github/workflows/prod-3-release-gate.yml", "utf8");

test("public gate front doors have package, catalog, and documentation parity", () => {
  const doors = ["verify:fast", "verify:pr", "verify:main", "release:verify", "release:verify:pr", "smoke:staging", "smoke:production"];
  for (const door of doors) {
    assert.ok(pkg.scripts[door], `${door}: package script`);
    assert.ok(docs.includes(`\`pnpm run ${door}\``), `${door}: docs`);
  }
  for (const node of catalog.nodes) assert.match(docs, new RegExp(node.tier), `${node.id}: tier docs`);
  assert.match(workflow, /Production readiness L3 release gate/);
  assert.match(workflow, /run release:verify:pr/);
  assert.match(workflow, /run release:verify/);
  const phase6 = readFileSync(".github/workflows/phase-6-gate.yml", "utf8");
  assert.match(phase6, /run phase-6:pr-fast-closure/);
  assert.match(phase6, /run phase-6:fast-closure/);
  assert.match(phase6, /run: pnpm run generate:workspace-registry/);
  assert.match(phase6, /run: bash scripts\/ci\/build-api-workspace-deps\.sh/);
});

test("workflow keeps aggregate release check and shared setup", () => {
  assert.match(workflow, /\.\/\.github\/actions\/setup-platform/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /\.artifacts\/gates/);
});
