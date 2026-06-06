#!/usr/bin/env node
/** DEC-108 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

for (const rel of [
  "src/observability/prometheus-format.ts",
  "src/routes/internal/metrics.ts",
  "src/observability/prometheus-format.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) violations.push(`${rel} must exist`);
}

const app = read("src/app.ts");
if (!app.includes("/internal/metrics") || !app.includes("handleInternalMetrics")) {
  violations.push("app.ts must wire GET /internal/metrics");
}

const fmt = read("src/observability/prometheus-format.ts");
if (!fmt.includes("validation_queue_depth_total")) {
  violations.push("prometheus-format.ts must export validation_queue_depth_total");
}
if (!fmt.includes("http_requests_in_flight")) {
  violations.push("prometheus-format.ts must export http_requests_in_flight (DEC-121)");
}
if (!fmt.includes("outbox_pending_total")) {
  violations.push("prometheus-format.ts must export outbox_pending_total (DEC-121)");
}
if (!fmt.includes("outbox_failed_total")) {
  violations.push("prometheus-format.ts must export outbox_failed_total (DEC-123)");
}
if (!fmt.includes("domain_event_handler_slow_total")) {
  violations.push("prometheus-format.ts must export domain_event_handler_slow_total (OB-COND-01)");
}
if (!fmt.includes("health_probe_p99_ms")) {
  violations.push("prometheus-format.ts must export health_probe_p99_ms (NN-01 / A1)");
}

const metricsRoute = read("src/routes/internal/metrics.ts");
if (!metricsRoute.includes("OPS_SCOPE_METRICS_READ")) {
  violations.push("metrics.ts must allow production scrape with ops_scope metrics:read");
}

if (violations.length) {
  console.error("guard-metrics-prometheus-export: FAIL");
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}
console.log("guard-metrics-prometheus-export: PASS");
