#!/usr/bin/env node
/**
 * R-05 — control plane must be ACTIVE and CI-enforced (failure-first).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const authorityPath = path.join(REPO_ROOT, "scripts/guards/control-authority.mjs");
if (!existsSync(authorityPath)) {
  violations.push("R-05: control-authority.mjs missing");
}

const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
if (!pkg.scripts?.["control:authority"]) {
  violations.push("R-05: package.json missing control:authority script");
}
if (!pkg.scripts?.["control:ci"]) {
  violations.push("R-05: package.json missing control:ci script");
}

const ciWorkflow = path.join(REPO_ROOT, ".github/workflows/control-authority-guard.yml");
if (!existsSync(ciWorkflow)) {
  violations.push("R-05: control-authority-guard.yml CI workflow missing");
}

const runnerPath = path.join(REPO_ROOT, "scripts/guards/lib/run-control-pack.mjs");
const runner = readFileSync(runnerPath, "utf8");
const codeOnly = runner
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
if (/completed:\s*true|status:\s*["']DONE["']|status:\s*["']COMPLETE["']|status:\s*["']FINISHED["']/i.test(codeOnly)) {
  violations.push("R-05: control runner contains completion semantics (forbidden)");
}

if (violations.length > 0) {
  console.error("guard-control-plane-r05: BLOCKED R-05");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-control-plane-r05: PASS (ctl=ACTIVE)");
