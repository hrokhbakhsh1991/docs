#!/usr/bin/env node
/**
 * OB-COND-01 — domain event handler duration budget monitor must be wired.
 * @see docs/phase-5/appendices/domain-event-handler-monitor.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(ROOT, "../..");
const violations = [];

const busPath = path.join(REPO_ROOT, "packages/platform-events/src/bus.ts");
const monitorPath = path.join(REPO_ROOT, "packages/platform-events/src/handler-monitor.ts");
const indexPath = path.join(REPO_ROOT, "packages/platform-events/src/index.ts");
const prometheusPath = path.join(ROOT, "src/observability/prometheus-format.ts");

for (const required of [busPath, monitorPath, indexPath, prometheusPath]) {
  if (!fs.existsSync(required)) {
    violations.push(`missing ${path.relative(REPO_ROOT, required)}`);
  }
}

if (fs.existsSync(busPath)) {
  const bus = fs.readFileSync(busPath, "utf8");
  if (!bus.includes("recordDomainEventHandlerDuration")) {
    violations.push("bus.ts must record handler duration via handler-monitor");
  }
}

if (fs.existsSync(indexPath)) {
  const index = fs.readFileSync(indexPath, "utf8");
  if (!index.includes("readDomainEventHandlerSlowTotal")) {
    violations.push("platform-events index must export readDomainEventHandlerSlowTotal");
  }
}

if (fs.existsSync(prometheusPath)) {
  const prometheus = fs.readFileSync(prometheusPath, "utf8");
  if (!prometheus.includes("domain_event_handler_slow_total")) {
    violations.push("prometheus-format.ts must export domain_event_handler_slow_total");
  }
}

if (violations.length > 0) {
  console.error("guard:domain-event-handler-monitor: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard:domain-event-handler-monitor: PASS");
