#!/usr/bin/env node
/**
 * DEC-070 — nightly slow-sink adversarial spec lock (not trunk regression gate).
 * @see docs/phase-5/appendices/logging-backpressure.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = path.join(ROOT, "test/3-performance/log-slow-sink-adversarial.spec.ts");
const PKG = path.join(ROOT, "package.json");
const violations = [];

if (!fs.existsSync(SPEC)) {
  violations.push("log-slow-sink-adversarial.spec.ts must exist");
} else {
  const source = fs.readFileSync(SPEC, "utf8");
  if (!source.includes("skipUnlessNightlyTier")) {
    violations.push("slow-sink spec must gate on skipUnlessNightlyTier");
  }
  if (!source.includes("withRequestLogging")) {
    violations.push("slow-sink spec must exercise withRequestLogging");
  }
  if (!source.includes("SLOW_SINK_HTTP_P99_CEILING_MS")) {
    violations.push("slow-sink spec must define HTTP p99 ceiling");
  }
  if (!source.includes("log_sink_drop_total")) {
    violations.push("slow-sink spec must assert bounded sink drop metric");
  }
}

const pkg = JSON.parse(fs.readFileSync(PKG, "utf8"));
if (!pkg.scripts?.["test:nightly:slow-sink"]) {
  violations.push("package.json must define test:nightly:slow-sink script");
}

if (violations.length > 0) {
  console.error("guard-log-slow-sink-nightly: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-log-slow-sink-nightly: PASS");
