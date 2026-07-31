#!/usr/bin/env node
/**
 * DG-6 clone ratchet: prevent G1/proof workspaces from growing Denali-parallel
 * product stems. Common loader/registration-flow filenames are infrastructure,
 * not product clones. Urban keeps its audited legacy baseline but may only
 * shrink it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_ROOT = process.env.DENALI_GRAVITY_WORKSPACES_ROOT
  ? path.resolve(process.env.DENALI_GRAVITY_WORKSPACES_ROOT)
  : path.join(REPO_ROOT, "packages/workspaces");
const SCAN_DIRS = ["http", "auth", "tours", "catalog", "exposure"];
const INFRASTRUCTURE_STEMS = new Set(["index.ts", "react.ts", "routes-manifest.ts", "routes.ts"]);
const ADAPTER_BUDGET_EXCLUDED_STEMS = new Set(["index.ts", "react.ts", "routes.ts"]);
const G1_ADAPTER_MODULE_BUDGET = 15;
const URBAN_AUDITED_OVERLAP = Object.freeze({
  infrastructure: new Set(["index.ts", "react.ts", "routes-manifest.ts", "routes.ts"]),
  thinAdapter: new Set([
    "canonical-patch-merge.ts",
    "exposure-resolver.port.ts",
    "host-ports.ts",
    "host-runtime.ts",
    "require-workspace-owner.ts",
    "tour-publish-field-gate.ts",
    "tour-store.port.ts",
    "tour-write-hooks.ts",
  ]),
  domainOwned: new Set(["catalog.service.ts", "product.routes.ts", "registration.service.ts"]),
});
const URBAN_AUDITED_BASELINE = new Set(Object.values(URBAN_AUDITED_OVERLAP).flatMap((set) => [...set]));

function collectBasenames(workspaceId) {
  const names = new Set();
  for (const dirName of SCAN_DIRS) {
    const root = path.join(WORKSPACES_ROOT, workspaceId, "src", dirName);
    walk(root, names);
  }
  return names;
}

function walk(dir, names) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, names);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      names.add(entry.name);
    }
  }
}

function overlap(left, right) {
  return [...left].filter((name) => right.has(name)).sort();
}

function collectSourceFiles(workspaceId) {
  const files = [];
  const root = path.join(WORKSPACES_ROOT, workspaceId, "src");
  walkFiles(root, files);
  return files;
}

function walkFiles(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(absolute);
    }
  }
}

function countG1AdapterModules(workspaceId) {
  return collectSourceFiles(workspaceId).filter(
    (file) => !ADAPTER_BUDGET_EXCLUDED_STEMS.has(path.basename(file)),
  ).length;
}

if (!fs.existsSync(path.join(WORKSPACES_ROOT, "denali", "src"))) {
  console.error("guard-denali-gravity-clones: FAIL — Denali workspace missing");
  process.exit(1);
}

const denali = collectBasenames("denali");
const violations = [];

for (const workspaceId of ["harbor", "guest-club"]) {
  const unexpected = overlap(collectBasenames(workspaceId), denali).filter(
    (name) => !INFRASTRUCTURE_STEMS.has(name),
  );
  if (unexpected.length > 0) {
    violations.push(`${workspaceId}: Denali-parallel product stems: ${unexpected.join(", ")}`);
  }
}

const harborAdapterModules = countG1AdapterModules("harbor");
if (harborAdapterModules > G1_ADAPTER_MODULE_BUDGET) {
  violations.push(
    `harbor: G1 adapter modules ${harborAdapterModules} exceed budget ${G1_ADAPTER_MODULE_BUDGET}`,
  );
}

const urbanOverlap = overlap(collectBasenames("urban"), denali);
const urbanGrowth = urbanOverlap.filter((name) => !URBAN_AUDITED_BASELINE.has(name));
if (urbanGrowth.length > 0) {
  violations.push(`urban: overlap grew beyond audited baseline: ${urbanGrowth.join(", ")}`);
}

if (violations.length > 0) {
  console.error("guard-denali-gravity-clones: FAIL");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(
  `guard-denali-gravity-clones: PASS (harbor adapters=${harborAdapterModules}/${G1_ADAPTER_MODULE_BUDGET}; harbor/guest-club product overlap=0; urban unclassified=0, infrastructure=${URBAN_AUDITED_OVERLAP.infrastructure.size}, thin-adapter=${URBAN_AUDITED_OVERLAP.thinAdapter.size}, domain=${URBAN_AUDITED_OVERLAP.domainOwned.size})`,
);
