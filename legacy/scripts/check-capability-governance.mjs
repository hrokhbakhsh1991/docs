#!/usr/bin/env node
/**
 * Phase 17.1 — fail CI when capability governance registry drifts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const failures = [];

function fail(msg) {
  failures.push(msg);
}

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function extractWorkspaceCapabilities(registrySrc) {
  const start = registrySrc.indexOf("WORKSPACE_CAPABILITY_VALUES");
  const slice = registrySrc.slice(start, start + 2500);
  const values = [];
  const re = /"([^"]+\.[^"]+)"/g;
  let m;
  while ((m = re.exec(slice)) !== null) {
    values.push(m[1]);
  }
  return [...new Set(values)];
}

function extractGovernedKeys(governanceSrc) {
  const keys = [];
  const re = /key:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(governanceSrc)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

function extractOwners(governanceSrc) {
  const owners = [];
  const re = /owner:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(governanceSrc)) !== null) {
    owners.push(m[1]);
  }
  return owners;
}

const registrySrc = readRepo("packages/shared/rbac/capability-registry.ts");
const governanceSrc = readRepo("packages/shared/rbac/capability-governance.ts");

const registered = extractWorkspaceCapabilities(registrySrc);
const governed = extractGovernedKeys(governanceSrc);
const governedSet = new Set(governed);

for (const cap of registered) {
  if (!governedSet.has(cap)) {
    fail(`undocumented capability: ${cap}`);
  }
}

for (const cap of governed) {
  if (!registered.includes(cap)) {
    fail(`unknown governed capability: ${cap}`);
  }
}

const dupes = governed.filter((k, i) => governed.indexOf(k) !== i);
if (dupes.length) {
  fail(`duplicate governance keys: ${[...new Set(dupes)].join(", ")}`);
}

const owners = extractOwners(governanceSrc);
if (owners.some((o) => !o.trim())) {
  fail("capability missing owner");
}

if (failures.length) {
  for (const _f of failures) {
  }
  process.exit(1);
}

