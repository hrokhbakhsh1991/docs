#!/usr/bin/env node
/**
 * DEC-055 — operational roster must not fan out page-wide Promise.all over bookings.
 * @see docs/workspaces/denali/operational-roster.mdoc § Composition budget
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

const servicePath = "src/roster/operational-roster.service.ts";
const serviceSource = fs.readFileSync(path.join(ROOT, servicePath), "utf8");

if (!serviceSource.includes("enrichOperationalRosterRowsBudgetSafe")) {
  violations.push(
    `${servicePath} must compose rows via enrichOperationalRosterRowsBudgetSafe`
  );
}

if (/Promise\.all\s*\(\s*bookings\.items\.map/m.test(serviceSource)) {
  violations.push(`${servicePath} must not Promise.all over bookings.items.map`);
}

const enrichmentPath = "src/roster/operational-roster-enrichment.ts";
const enrichmentSource = fs.readFileSync(path.join(ROOT, enrichmentPath), "utf8");

if (/Promise\.all/m.test(enrichmentSource)) {
  violations.push(`${enrichmentPath} must not use Promise.all during row enrichment`);
}

if (!enrichmentSource.includes("for (const booking of bookings)")) {
  violations.push(`${enrichmentPath} must iterate bookings sequentially`);
}

if (violations.length > 0) {
  console.error("guard-operational-roster-budget: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-operational-roster-budget: PASS");
