#!/usr/bin/env node
/**
 * SCAL-DEBT-15 / DEC-061 — compiled cold-start readiness gate must exist in CI.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-061
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/cold-start-readiness-gate.mjs");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const LATENCY_SPEC = path.join(ROOT, "test/3-performance/cold-start-latency.spec.ts");
const WORKER = path.join(ROOT, "test/3-performance/cold-start-http-worker.ts");
const violations = [];

if (!fs.existsSync(SCRIPT)) {
  violations.push("missing scripts/cold-start-readiness-gate.mjs");
} else {
  const source = fs.readFileSync(SCRIPT, "utf8");
  if (!source.includes("dist/main.js")) {
    violations.push("cold-start-readiness-gate.mjs must probe dist/main.js");
  }
  if (!source.includes("COLD_START_READINESS_BUDGET_MS")) {
    violations.push("cold-start-readiness-gate.mjs must honor COLD_START_READINESS_BUDGET_MS");
  }
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("cold-start-readiness-gate")) {
  violations.push("phase-3-regression-gate.mjs must invoke cold-start-readiness-gate");
}

if (!fs.existsSync(LATENCY_SPEC)) {
  violations.push("missing test/3-performance/cold-start-latency.spec.ts");
} else {
  const latencySpec = fs.readFileSync(LATENCY_SPEC, "utf8");
  if (!latencySpec.includes("COLD_START_ENGINE_BUDGET_MS")) {
    violations.push("cold-start-latency.spec.ts must define COLD_START_ENGINE_BUDGET_MS (CON-03)");
  }
  if (!latencySpec.includes("COLD_START_HTTP_BUDGET_MS")) {
    violations.push("cold-start-latency.spec.ts must define COLD_START_HTTP_BUDGET_MS (CON-03)");
  }
  if (!latencySpec.includes("COLD_START_READINESS_BUDGET_MS")) {
    violations.push(
      "cold-start-latency.spec.ts HTTP budget must fall back to COLD_START_READINESS_BUDGET_MS"
    );
  }
  if (!latencySpec.includes("COLD_START_WORKER_READY_BUDGET_MS")) {
    violations.push("cold-start-latency.spec.ts must assert CS-UNSC-02 worker ready budget");
  }
}

if (!fs.existsSync(WORKER)) {
  violations.push("missing test/3-performance/cold-start-http-worker.ts");
} else {
  const workerSource = fs.readFileSync(WORKER, "utf8");
  if (workerSource.includes("@app-tour/platform-core")) {
    violations.push("cold-start-http-worker.ts must not eagerly import platform-core (CS-UNSC-02)");
  }
  if (!workerSource.includes("cold-start-http-probe")) {
    violations.push("cold-start-http-worker.ts must lazy-import cold-start-http-probe");
  }
}

if (violations.length > 0) {
  console.error("guard:cold-start-readiness-gate: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard:cold-start-readiness-gate: PASS");
