#!/usr/bin/env node
/**
 * CS-UNSC-01 / A2 — tsx dev cold-start must stay out of enforce gates.
 * @see docs/phase-5/appendices/cold-start-tsx-dev-waiver.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readRepo(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const waiverDoc = path.join(REPO_ROOT, "docs/phase-5/appendices/cold-start-tsx-dev-waiver.md");
if (!fs.existsSync(waiverDoc)) {
  violations.push("missing docs/phase-5/appendices/cold-start-tsx-dev-waiver.md");
}

const probeScript = path.join(ROOT, "scripts/cold-start-tsx-dev-probe.mjs");
if (!fs.existsSync(probeScript)) {
  violations.push("missing scripts/cold-start-tsx-dev-probe.mjs");
} else {
  const probe = fs.readFileSync(probeScript, "utf8");
  if (!probe.includes("waived: true")) {
    violations.push("cold-start-tsx-dev-probe.mjs artifact must set waived: true");
  }
  if (!probe.includes('verdict: "PASS"')) {
    violations.push("cold-start-tsx-dev-probe.mjs must always record verdict PASS");
  }
  if (!probe.includes("--import") || !probe.includes("tsx") || !probe.includes("src/main.ts")) {
    violations.push("cold-start-tsx-dev-probe.mjs must spawn tsx src/main.ts");
  }
}

const readinessGate = read("scripts/cold-start-readiness-gate.mjs");
if (!readinessGate.includes("dist/main.js")) {
  violations.push("cold-start-readiness-gate.mjs must probe dist/main.js (production SoT)");
}
if (readinessGate.includes("tsx")) {
  violations.push("cold-start-readiness-gate.mjs must not use tsx — CS-UNSC-01 waived");
}

const phase3Gate = read("scripts/phase-3-regression-gate.mjs");
if (!phase3Gate.includes('COLD_START_READINESS_ENFORCE: "false"')) {
  violations.push("phase-3-regression-gate.mjs must keep COLD_START_READINESS_ENFORCE=false");
}
if (phase3Gate.includes("cold-start-latency.spec.ts")) {
  violations.push("phase-3-regression-gate.mjs must not run cold-start-latency.spec.ts on trunk");
}
if (phase3Gate.includes("cold-start-tsx-dev-probe")) {
  violations.push("phase-3-regression-gate.mjs must not run waived tsx probe on trunk");
}

const pkg = JSON.parse(read("package.json"));
if (!pkg.scripts?.["probe:cold-start-tsx-dev"]) {
  violations.push("package.json must define probe:cold-start-tsx-dev");
}
const nightlyCold = pkg.scripts?.["test:nightly:cold-start"] ?? "";
if (!nightlyCold.includes("dist/main.js") && !nightlyCold.includes("cold-start-readiness-gate")) {
  violations.push("test:nightly:cold-start must use compiled cold-start-readiness-gate");
}
if (nightlyCold.includes("tsx")) {
  violations.push("test:nightly:cold-start must not enforce tsx dev path");
}

const lazyBootDoc = readRepo("docs/phase-5/appendices/cold-start-lazy-boot.md");
if (!lazyBootDoc.includes("CS-UNSC-01")) {
  violations.push("cold-start-lazy-boot.md must document CS-UNSC-01 waiver");
}

if (violations.length > 0) {
  console.error("guard:cold-start-tsx-waiver: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:cold-start-tsx-waiver: PASS");
