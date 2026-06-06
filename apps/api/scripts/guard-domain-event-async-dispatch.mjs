#!/usr/bin/env node
/**
 * DEC-071 / OB-COND-01 — domain bus must defer handler work off publishDomainEvent return.
 * @see docs/phase-5/appendices/domain-event-async-dispatch.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const BUS = path.join(REPO_ROOT, "packages/platform-events/src/bus.ts");
const INDEX = path.join(REPO_ROOT, "packages/platform-events/src/index.ts");

const violations = [];

if (!fs.existsSync(BUS)) {
  violations.push("missing packages/platform-events/src/bus.ts");
} else {
  const busSource = fs.readFileSync(BUS, "utf8");
  if (!busSource.includes("setImmediate")) {
    violations.push("bus.ts must defer handler dispatch with setImmediate");
  }
  if (!busSource.includes("flushDomainEventDispatch")) {
    violations.push("bus.ts must export flushDomainEventDispatch test helper");
  }
}

if (!fs.existsSync(INDEX)) {
  violations.push("missing packages/platform-events/src/index.ts");
} else {
  const indexSource = fs.readFileSync(INDEX, "utf8");
  if (!indexSource.includes("flushDomainEventDispatch")) {
    violations.push("platform-events index must re-export flushDomainEventDispatch");
  }
}

if (violations.length > 0) {
  console.error("guard:domain-event-async-dispatch: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:domain-event-async-dispatch: PASS");
