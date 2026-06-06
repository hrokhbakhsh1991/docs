#!/usr/bin/env node
/**
 * DEC-101 — HTTP ingress must reject during graceful shutdown.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of ["src/http/shutdown-ingress.ts", "src/http/shutdown-ingress.spec.ts"]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const app = read("src/app.ts");
if (!app.includes("rejectRequestDuringShutdown")) {
  violations.push("app.ts must call rejectRequestDuringShutdown before dispatchRequest");
}

const ingress = read("src/http/shutdown-ingress.ts");
if (!ingress.includes("isGracefulShutdownInProgress")) {
  violations.push("shutdown-ingress.ts must use isGracefulShutdownInProgress");
}
if (!ingress.includes("shutting_down")) {
  violations.push("shutdown-ingress.ts must return shutting_down 503 body");
}

const checklist = fs.readFileSync(
  path.join(ROOT, "../../docs/phase-4/production-deploy-checklist.md"),
  "utf8"
);
if (!checklist.includes("terminationGracePeriodSeconds")) {
  violations.push("production-deploy-checklist.md must document terminationGracePeriodSeconds");
}

if (violations.length > 0) {
  console.error("guard-shutdown-ingress: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-shutdown-ingress: PASS");
