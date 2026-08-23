#!/usr/bin/env node
/**
 * PSR-3b — local smoke: portal pilot on composite; required checks frozen;
 * family runners still share one implementation. No Actions run / full gate.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`psr-3b-smoke: FAIL — ${msg}`);
  process.exitCode = 1;
}

const portal = readFileSync(join(root, ".github/workflows/portal-control-guard.yml"), "utf8");
if (!portal.includes("./.github/actions/setup-platform")) {
  fail("portal-control-guard.yml must use setup-platform");
}
if (/pnpm\/action-setup@/.test(portal)) {
  fail("portal-control-guard.yml must not inline pnpm/action-setup");
}
if (!/engine-check-enabled:\s*"false"/.test(portal)) {
  fail("portal pilot must keep engine-check-enabled: \"false\" for parity");
}
if (!portal.includes("pnpm run control:ci")) {
  fail("portal business step control:ci must remain");
}
if (!/^jobs:\n  portal-control:/m.test(portal) && !portal.includes("\n  portal-control:\n")) {
  fail("job id portal-control must remain");
}

const { MAIN_BRANCH_REQUIRED_CHECKS } = require(
  join(root, "scripts/ops/main-branch-required-checks.mjs"),
);
const expected = [
  "Production readiness L3 release gate",
  "Phase 0 foundation gate",
  "Phase 0 integration gate",
  "Phase 1 platform-core gate",
  "Booking PostgreSQL capacity",
  "Booking HTTP PostgreSQL",
];
if (JSON.stringify(MAIN_BRANCH_REQUIRED_CHECKS) !== JSON.stringify(expected)) {
  fail("MAIN_BRANCH_REQUIRED_CHECKS drifted — PSR-3b forbids required-name edits");
}

for (const name of ["phase-0-gate.yml", "phase-1-gate.yml", "booking-postgres-gate.yml"]) {
  const text = readFileSync(join(root, ".github/workflows", name), "utf8");
  if (text.includes("./.github/actions/setup-platform")) {
    fail(`${name} must remain deferred (no composite in PSR-3b)`);
  }
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const families = ["guard:marketing", "guard:workspace", "guard:field-exposure", "guard:guest"];
for (const k of families) {
  const body = pkg.scripts[k] || "";
  if (!body.includes("run-guard-family.mjs")) {
    fail(`${k} must still delegate to run-guard-family.mjs`);
  }
}

const compositeCallers = [];
for (const name of [
  "api-nightly.yml",
  "doc-gate.yml",
  "finance-integrity.yml",
  "phase-2-gate.yml",
  "phase-3-gate.yml",
  "portal-control-guard.yml",
]) {
  const text = readFileSync(join(root, ".github/workflows", name), "utf8");
  if (!text.includes("./.github/actions/setup-platform")) {
    fail(`expected composite caller missing: ${name}`);
  }
  compositeCallers.push(name);
}

if (!process.exitCode) {
  console.log("psr-3b-smoke: PASS");
  console.log("  composite callers:", compositeCallers.join(", "));
  console.log("  required checks frozen:", MAIN_BRANCH_REQUIRED_CHECKS.length);
  console.log("  family runners: shared run-guard-family.mjs");
}
