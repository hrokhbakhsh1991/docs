#!/usr/bin/env node
/**
 * DEC-095 — db:test-reset production guard wiring lock.
 * @see docs/phase-5/appendices/db-test-reset-prod-guard.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const scriptPath = path.join(REPO_ROOT, "scripts/db-test-reset.sh");
const violations = [];

if (!fs.existsSync(scriptPath)) {
  violations.push("scripts/db-test-reset.sh must exist");
} else {
  const script = fs.readFileSync(scriptPath, "utf8");
  if (!script.includes("NODE_ENV") || !script.includes("production")) {
    violations.push("db-test-reset.sh must block NODE_ENV=production");
  }
  if (!script.includes("CONFIRM_TEST_RESET")) {
    violations.push("db-test-reset.sh must require CONFIRM_TEST_RESET for prod-like URLs");
  }
  if (!script.includes("prod")) {
    violations.push("db-test-reset.sh must include prod URL heuristics");
  }
}

if (violations.length > 0) {
  console.error("guard-db-test-reset-prod: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-db-test-reset-prod: PASS");
