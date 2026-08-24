#!/usr/bin/env node
/**
 * MAT-014 — lightweight deprecation policy guard.
 * Verifies policy doc exists and known deprecated manifest aliases are documented.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const POLICY_PATH = path.join(REPO_ROOT, "docs/standards/deprecation-policy.md");
const MATURITY_PLAN_PATH = path.join(REPO_ROOT, "docs/dev/enterprise-maturity-plan.md");

const REQUIRED_SECTIONS = [
  "Lifecycle states",
  "Deprecation annotation requirements",
  "Known deprecated aliases",
];

const KNOWN_DEPRECATED_ALIASES = [
  "catalogRegistrationFlow.transportInitializerExport",
  "equipmentIconKeyValidator",
];

function main() {
  const failures = [];

  if (!fs.existsSync(POLICY_PATH)) {
    failures.push(`missing ${path.relative(REPO_ROOT, POLICY_PATH)}`);
  } else {
    const policy = fs.readFileSync(POLICY_PATH, "utf8");
    for (const section of REQUIRED_SECTIONS) {
      if (!policy.includes(section)) {
        failures.push(`deprecation-policy.md missing section: ${section}`);
      }
    }
    for (const alias of KNOWN_DEPRECATED_ALIASES) {
      if (!policy.includes(alias)) {
        failures.push(`deprecation-policy.md must document alias: ${alias}`);
      }
    }
  }

  if (!fs.existsSync(MATURITY_PLAN_PATH)) {
    failures.push(`missing ${path.relative(REPO_ROOT, MATURITY_PLAN_PATH)}`);
  }

  if (failures.length > 0) {
    console.error("guard-deprecation-policy FAILED:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("guard-deprecation-policy OK");
}

main();
