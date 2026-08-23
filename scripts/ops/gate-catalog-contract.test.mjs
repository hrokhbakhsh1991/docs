import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const catalog = JSON.parse(readFileSync(join(root, "docs/platform/PROD-3-GATE-CATALOG.json"), "utf8"));
const runnerSource = readFileSync(join(root, "scripts/ops/run-gate-catalog.mjs"), "utf8");

test("gate catalog has unique ids, valid references, and no cycles", () => {
  const ids = new Set(catalog.nodes.map((node) => node.id));
  assert.equal(ids.size, catalog.nodes.length);
  for (const node of catalog.nodes) {
    assert.ok(catalog.tiers[node.tier], `${node.id}: tier`);
    for (const dependency of node.dependsOn) assert.ok(ids.has(dependency), `${node.id}: ${dependency}`);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    assert.ok(!visiting.has(id), `cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const node = catalog.nodes.find((candidate) => candidate.id === id);
    node.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  catalog.nodes.forEach((node) => visit(node.id));
});

test("catalog nodes have ownership and execution metadata", () => {
  for (const node of catalog.nodes) {
    assert.match(node.id, /^[a-z0-9.-]+$/);
    assert.ok(node.owner);
    assert.match(node.command, /^(env [A-Z0-9_]+=.+ )?pnpm /);
    assert.ok(Array.isArray(node.paths) && node.paths.length > 0);
    assert.ok(node.sideEffects);
  }
});

test("catalog has no duplicate executable steps and is ordered after dependencies", () => {
  const executableKeys = new Set();
  const positions = new Map(catalog.nodes.map((node, index) => [node.id, index]));
  for (const node of catalog.nodes) {
    const key = `${node.tier}:${node.command}`;
    assert.ok(!executableKeys.has(key), `duplicate executable step: ${key}`);
    executableKeys.add(key);
    for (const dependency of node.dependsOn) {
      assert.ok(positions.get(dependency) < positions.get(node.id), `${node.id}: dependency ${dependency} must run first`);
    }
  }
});

test("gate runner supports dependency closure and single-node chunk execution", () => {
  assert.match(runnerSource, /--only/);
  assert.match(runnerSource, /dependenciesIncluded/);
  assert.match(runnerSource, /selectWithDependencies/);
});
