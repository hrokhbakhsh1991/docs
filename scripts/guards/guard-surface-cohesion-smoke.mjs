#!/usr/bin/env node
/**
 * PSC-001 Phase 3 — cross-surface smoke matrix guard (extends SMK-*; no duplicate suite).
 * @see docs/dev/platform-surface-cohesion-smoke-matrix.yaml
 * @see docs/standards/platform-surface-cohesion.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MATRIX_PATH = path.join(REPO_ROOT, "docs/dev/platform-surface-cohesion-smoke-matrix.yaml");
const REGISTRATION_HOOKS_PATH = path.join(REPO_ROOT, "docs/dev/guest-registration-e2e-hooks.yaml");

const REQUIRED_STATIC_IDS = [
  "SMK-PSC-01",
  "SMK-PSC-02",
  "SMK-PSC-03",
  "SMK-PSC-04",
  "SMK-PSC-05",
  "SMK-PSC-06",
];

const REQUIRED_E2E_IDS = ["SMK-WRS-CUSTOM-APEX", "SMK-MKT-03", "SMK-PTL-01", "SMK-PTL-08"];

/** @type {string[]} */
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/**
 * @param {string} raw
 * @param {"static" | "e2e"} section
 */
function parseMatrixSection(raw, section) {
  const marker = `${section}:`;
  const start = raw.indexOf(marker);
  if (start === -1) {
    return [];
  }
  const after = raw.slice(start + marker.length);
  const nextSection = after.search(/^[a-z][a-z0-9_-]*:/m);
  const block = nextSection === -1 ? after : after.slice(0, nextSection);
  return [...block.matchAll(/- id: ([^\n]+)\n(?:.*\n)*?    spec: ([^\n]+)/g)].map(
    ([, id, specRel]) => ({ id: id.trim(), specRel: specRel.trim() })
  );
}

if (!fs.existsSync(MATRIX_PATH)) {
  console.error("guard-surface-cohesion-smoke: FAIL — smoke matrix YAML missing");
  process.exit(1);
}

const matrixRaw = read("docs/dev/platform-surface-cohesion-smoke-matrix.yaml");
const staticHooks = parseMatrixSection(matrixRaw, "static");
const e2eHooks = parseMatrixSection(matrixRaw, "e2e");

for (const requiredId of REQUIRED_STATIC_IDS) {
  if (!staticHooks.some((hook) => hook.id === requiredId)) {
    violations.push(`smoke matrix missing required static hook ${requiredId}`);
  }
}

for (const requiredId of REQUIRED_E2E_IDS) {
  if (!e2eHooks.some((hook) => hook.id === requiredId)) {
    violations.push(`smoke matrix missing required e2e hook ${requiredId}`);
  }
}

for (const hook of [...staticHooks, ...e2eHooks]) {
  const specPath = path.join(REPO_ROOT, hook.specRel);
  if (!fs.existsSync(specPath)) {
    violations.push(`${hook.id}: spec missing at ${hook.specRel}`);
  }
}

if (fs.existsSync(REGISTRATION_HOOKS_PATH)) {
  const registrationRaw = read("docs/dev/guest-registration-e2e-hooks.yaml");
  for (const hookId of ["SMK-MKT-03", "SMK-PTL-01"]) {
    if (!registrationRaw.includes(`- id: ${hookId}`)) {
      violations.push(`${hookId}: must exist in guest-registration-e2e-hooks.yaml`);
    }
  }
}

if (violations.length > 0) {
  console.error(`guard-surface-cohesion-smoke: FAIL (${violations.length})`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  `guard-surface-cohesion-smoke: PASS (${staticHooks.length} static + ${e2eHooks.length} e2e hooks)`
);
