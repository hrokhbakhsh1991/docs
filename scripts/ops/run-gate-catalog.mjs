#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadApiEnv } from "./load-api-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
loadApiEnv(join(root, "apps/api"));
const catalogPath = join(root, "docs/platform/PROD-3-GATE-CATALOG.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const requestedTier = process.argv.find((arg) => arg.startsWith("--tier="))?.slice(7);
const requestedNode = process.argv.find((arg) => arg.startsWith("--node="))?.slice(7);
const dependenciesIncluded = !process.argv.includes("--only");
const reportPath = process.env.GATE_REPORT ?? join(root, ".artifacts/gates/gate-report.json");

function validate() {
  const ids = new Set();
  const errors = [];
  for (const node of catalog.nodes) {
    if (ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    ids.add(node.id);
    if (!catalog.tiers[node.tier]) errors.push(`${node.id}: unknown tier ${node.tier}`);
    if (!Array.isArray(node.dependsOn)) errors.push(`${node.id}: dependsOn must be an array`);
    for (const dependency of node.dependsOn ?? []) {
      if (!catalog.nodes.some((candidate) => candidate.id === dependency)) errors.push(`${node.id}: missing dependency ${dependency}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) errors.push(`cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const node = catalog.nodes.find((candidate) => candidate.id === id);
    for (const dependency of node?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of catalog.nodes) visit(node.id);
  return errors;
}

const validationErrors = validate();
if (validationErrors.length) {
  console.error(validationErrors.join("\n"));
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(`gate-catalog: PASS (${catalog.nodes.length} nodes, ${Object.keys(catalog.tiers).length} tiers)`);
  process.exit(0);
}

const requested = catalog.nodes.filter((node) => (!requestedTier || node.tier === requestedTier) && (!requestedNode || node.id === requestedNode));
const selectedIds = new Set();
const selectWithDependencies = (node) => {
  if (selectedIds.has(node.id)) return;
  selectedIds.add(node.id);
  for (const dependency of node.dependsOn) selectWithDependencies(catalog.nodes.find((candidate) => candidate.id === dependency));
};
if (dependenciesIncluded) {
  requested.forEach(selectWithDependencies);
} else {
  requested.forEach((node) => selectedIds.add(node.id));
}
const selected = catalog.nodes.filter((node) => selectedIds.has(node.id));
if (!selected.length) {
  console.error("gate-catalog: no matching nodes");
  process.exit(1);
}
const startedAt = new Date().toISOString();
const results = [];
for (const node of selected) {
  const start = Date.now();
  const command = node.command.replace(/^pnpm /, "pnpm ");
  const result = spawnSync("sh", ["-lc", command], { cwd: root, encoding: "utf8", env: process.env, timeout: catalog.tiers[node.tier].timeoutSeconds * 1000 });
  results.push({ id: node.id, tier: node.tier, command, exitCode: result.status ?? 1, timedOut: result.error?.code === "ETIMEDOUT", signal: result.signal ?? null, durationMs: Date.now() - start, stdout: result.stdout ?? "", stderr: result.stderr ?? "" });
  if (result.status !== 0) break;
}
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify({ schemaVersion: 1, catalog: "PROD-3", startedAt, finishedAt: new Date().toISOString(), requestedTier: requestedTier ?? null, requestedNode: requestedNode ?? null, dependenciesIncluded, results }, null, 2) + "\n");
console.log(`gate-catalog: ${results.every((result) => result.exitCode === 0) ? "PASS" : "FAIL"} (${results.length}/${selected.length})`);
console.log(`gate-catalog: report ${reportPath}`);
process.exit(results.every((result) => result.exitCode === 0) ? 0 : 1);
