#!/usr/bin/env node
/**
 * PSR-3c — assert alias removals + CI-bound retention. No full gates.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;

function fail(msg) {
  console.error(`psr-3c-smoke: FAIL — ${msg}`);
  process.exitCode = 1;
}

for (const gone of ["guard:documentation-sync", "phase-3:doc-scaffold", "contract:test", "test:contract:foundation"]) {
  if (scripts[gone]) fail(`executable still present: ${gone}`);
}
for (const marker of ["//guard:documentation-sync", "//phase-3:doc-scaffold"]) {
  if (!scripts[marker]) fail(`missing comment marker: ${marker}`);
}
for (const keep of ["guard:doc-sync", "doc-gate", "phase-0:foundation-gate", "test:contract", "phase-0:covenant-gate", "phase-0:trunk-gate"]) {
  if (!scripts[keep]) fail(`must retain: ${keep}`);
}

const wf = readFileSync(join(root, ".github/workflows/phase-0-gate.yml"), "utf8");
if (!wf.includes("phase-0:foundation-gate")) {
  fail("phase-0-gate.yml must still invoke phase-0:foundation-gate");
}

const { MAIN_BRANCH_REQUIRED_CHECKS } = require(join(root, "scripts/ops/main-branch-required-checks.mjs"));
const expected = [
  "Phase 0 foundation gate",
  "Phase 0 integration gate",
  "Phase 1 platform-core gate",
  "Booking PostgreSQL capacity",
  "Booking HTTP PostgreSQL",
];
if (JSON.stringify(MAIN_BRANCH_REQUIRED_CHECKS) !== JSON.stringify(expected)) {
  fail("MAIN_BRANCH_REQUIRED_CHECKS drifted");
}

// AGENTS / docs should prefer canonical names for removed aliases
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
if (/pnpm run phase-3:doc-scaffold/.test(agents)) {
  fail("AGENTS.md still documents phase-3:doc-scaffold");
}
const readme = readFileSync(join(root, "docs/README.md"), "utf8");
if (/pnpm run guard:documentation-sync/.test(readme)) {
  fail("docs/README.md still documents guard:documentation-sync");
}

const execCount = Object.keys(scripts).filter((k) => !k.startsWith("//")).length;
if (execCount !== 308) {
  fail(`expected 308 executables, got ${execCount}`);
}

if (!process.exitCode) {
  console.log("psr-3c-smoke: PASS");
  console.log("  removed: guard:documentation-sync, phase-3:doc-scaffold");
  console.log("  retained CI-bound: phase-0:foundation-gate");
  console.log("  executables:", execCount);
}
