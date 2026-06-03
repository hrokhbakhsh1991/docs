#!/usr/bin/env node
/**
 * H-04 — Assert phase-0:foundation-gate is Zero-Debt Covenant only (KS-01).
 * Must be exactly `pnpm run test:phase-0` — no build/guards/doc-sync at root script level.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FOUNDATION_GATE_FORBIDDEN_BUILD_FILTERS,
  FOUNDATION_GATE_FORBIDDEN_BUILD_PATHS,
  FOUNDATION_GATE_FORBIDDEN_CRAWL_PATHS,
  REPO_ROOT,
} from "./foundation-gate-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FOUNDATION_GATE_SCRIPT_EXACT = "pnpm run test:phase-0";

function readFoundationGateScript() {
  const pkgPath = path.join(REPO_ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const script = pkg.scripts?.["phase-0:foundation-gate"];
  if (!script || typeof script !== "string") {
    throw new Error("missing package.json scripts.phase-0:foundation-gate");
  }
  return script.replace(/\s+/g, " ").trim();
}

function main() {
  const script = readFoundationGateScript();

  console.log("foundation-scope-assert: Foundation Gate (Zero-Debt Covenant)");
  console.log(`  script: ${script}`);

  /** @type {string[]} */
  const violations = [];

  if (script !== FOUNDATION_GATE_SCRIPT_EXACT) {
    violations.push(
      `foundation-gate must be exactly "${FOUNDATION_GATE_SCRIPT_EXACT}" (got: "${script}")`,
    );
  }

  if (!/\btest:phase-0\b/.test(script)) {
    violations.push("foundation-gate must invoke test:phase-0 (phase-0.contract.spec.ts aggregator)");
  }

  if (/\bpnpm\s+build\b/.test(script)) {
    violations.push("root `pnpm build` in foundation-gate (build runs inside workspace-sdk test:phase-0)");
  }

  if (/--filter\s+\S+\s+run\s+build/.test(script)) {
    violations.push("explicit package build in foundation-gate (use test:phase-0 only)");
  }

  if (/\bguard:doc-sync\b/.test(script) || /\bguard:documentation-sync\b/.test(script)) {
    violations.push("guard:doc-sync belongs in phase-0:integration-gate only");
  }

  if (/\bphase-0-guard\.mjs\b/.test(script) || /\bphase-0:guard\b/.test(script)) {
    violations.push("phase-0-guard.mjs belongs in phase-0:integration-gate only");
  }

  if (/\bguard:architecture\b/.test(script)) {
    violations.push("guard:architecture is integration-gate only");
  }

  if (/\bguard:import-boundary\b/.test(script)) {
    violations.push("guard:import-boundary is integration-gate only");
  }

  for (const forbiddenPath of FOUNDATION_GATE_FORBIDDEN_BUILD_PATHS) {
    if (script.includes(forbiddenPath)) {
      violations.push(`forbidden path reference in foundation-gate script: ${forbiddenPath}`);
    }
  }

  for (const forbiddenFilter of FOUNDATION_GATE_FORBIDDEN_BUILD_FILTERS) {
    if (script.includes(forbiddenFilter)) {
      violations.push(`forbidden filter reference in foundation-gate script: ${forbiddenFilter}`);
    }
  }

  for (const crawlPath of FOUNDATION_GATE_FORBIDDEN_CRAWL_PATHS) {
    if (script.includes(crawlPath)) {
      violations.push(`forbidden crawl path in foundation-gate script: ${crawlPath}`);
    }
  }

  if (/\btest:contract:monorepo\b/.test(script)) {
    violations.push("test:contract:monorepo belongs in phase-0:integration-gate only");
  }

  if (/\btest:invariants\b/.test(script)) {
    violations.push("test:invariants is inside test:phase-0 aggregator — do not invoke separately");
  }

  if (/\bLEGACY_IMPORT_SCAN_SCOPE=monorepo\b/.test(script)) {
    violations.push("LEGACY_IMPORT_SCAN_SCOPE=monorepo is integration-gate only");
  }

  if (/\bpnpm\s+test\b/.test(script) && !/\btest:phase-0\b/.test(script)) {
    violations.push("root `pnpm test` in foundation-gate (full monorepo — use integration-gate)");
  }

  if (violations.length > 0) {
    console.error("\nfoundation-scope-assert: FAIL");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log("foundation-scope-assert: PASS — Zero-Debt Covenant (test:phase-0 only)");
}

main();
