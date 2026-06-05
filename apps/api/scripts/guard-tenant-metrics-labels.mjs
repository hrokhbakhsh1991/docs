#!/usr/bin/env node
/**
 * MET-API-01 / DEC-049 — tenant-scoped metrics must carry tenant_id label at call sites.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-049
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const TENANT_SCOPED = ["tour_creation_count", "projection_inconsistency_total"];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const violations = [];

const metricsTs = read("src/observability/metrics.ts");
if (!metricsTs.includes("TENANT_SCOPED_METRIC_NAMES")) {
  violations.push("metrics.ts: missing TENANT_SCOPED_METRIC_NAMES");
}
if (!metricsTs.includes("METRIC_TENANT_LABEL_REQUIRED")) {
  violations.push("metrics.ts: missing runtime tenant label guard");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(p);
    }
  }
  return out;
}

const INCREMENT_RE = /metricsRegistry\.increment\s*\(\s*["'`]([^"'`]+)["'`]/g;

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("metricsRegistry.increment")) {
    continue;
  }

  for (const match of text.matchAll(INCREMENT_RE)) {
    const metricName = match[1];
    if (!TENANT_SCOPED.includes(metricName)) {
      continue;
    }
    const start = match.index ?? 0;
    const snippet = text.slice(start, start + 400);
    if (!/tenant_id\s*:/.test(snippet)) {
      violations.push(
        `${rel}: metricsRegistry.increment("${metricName}") must include tenant_id label in call`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("guard-tenant-metrics-labels: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-metrics-labels: PASS");
