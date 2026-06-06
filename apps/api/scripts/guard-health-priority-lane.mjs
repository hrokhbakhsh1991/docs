#!/usr/bin/env node
/**
 * NN-08 — GET /health must bypass withRequestLogging at server root.
 * @see docs/phase-5/appendices/health-priority-lane.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of [
  "src/boot/health-priority-ingress.ts",
  "src/boot/health-priority-ingress.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const main = read("src/main.ts");
if (!main.includes("createHealthAwareServerListener")) {
  violations.push("main.ts must wire createHealthAwareServerListener");
}
if (!main.includes("createServer(createHealthAwareServerListener")) {
  violations.push("main.ts must pass createHealthAwareServerListener to createServer");
}
if (/createServer\s*\(\s*withRequestLogging/.test(main)) {
  violations.push("main.ts must not wrap createServer directly with withRequestLogging");
}

const ingress = read("src/boot/health-priority-ingress.ts");
if (!ingress.includes("isHealthGetRequest")) {
  violations.push("health-priority-ingress.ts must export isHealthGetRequest");
}
if (!ingress.includes("handleHealth")) {
  violations.push("health-priority-ingress.ts must call handleHealth on probe path");
}
const listenerStart = ingress.indexOf("export function createHealthAwareServerListener");
const listenerBody = listenerStart >= 0 ? ingress.slice(listenerStart) : ingress;
const healthIdx = listenerBody.indexOf("isHealthGetRequest(req)");
const loggingIdx = listenerBody.indexOf("withRequestLogging");
if (healthIdx < 0 || loggingIdx >= 0) {
  violations.push(
    "createHealthAwareServerListener must branch on /health without calling withRequestLogging in the same function"
  );
}

const doc = fs.readFileSync(
  path.join(ROOT, "../../docs/phase-5/appendices/health-priority-lane.md"),
  "utf8"
);
if (!doc.includes("NN-08")) {
  violations.push("docs/phase-5/appendices/health-priority-lane.md must reference NN-08");
}

const gate = read("scripts/phase-3-regression-gate.mjs");
if (!gate.includes("guard:health-priority-lane")) {
  violations.push("phase-3-regression-gate.mjs must run guard:health-priority-lane");
}
if (!gate.includes("health-priority-ingress.spec.ts")) {
  violations.push("phase-3-regression-gate.mjs must run health-priority-ingress.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-health-priority-lane: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-health-priority-lane: PASS");
