#!/usr/bin/env node
/**
 * DEC-071 / Phase 4 step 1 — stale processing reclaim + shutdown drain.
 * @see docs/phase-5/appendices/outbox-processing-reclaim.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const reclaim = read("src/outbox/outbox-processing-reclaim.ts");
if (!reclaim.includes("reclaimStaleProcessingOutboxRows")) {
  violations.push("outbox-processing-reclaim.ts must export reclaimStaleProcessingOutboxRows");
}
if (!reclaim.includes("healPublishedProcessingOutboxRows")) {
  violations.push(
    "outbox-processing-reclaim.ts must export healPublishedProcessingOutboxRows (DEC-072)"
  );
}
if (!reclaim.includes("OUTBOX_PROCESSING_RECLAIM_MS")) {
  violations.push("outbox-processing-reclaim.ts must read OUTBOX_PROCESSING_RECLAIM_MS");
}
const shutdownDrain = read("src/outbox/outbox-shutdown-drain.ts");
if (!shutdownDrain.includes("drainOutboxRelayOnShutdown")) {
  violations.push("outbox-shutdown-drain.ts must export drainOutboxRelayOnShutdown");
}
if (!reclaim.includes("outbox_processing_reclaimed_total")) {
  violations.push("outbox-processing-reclaim.ts must increment outbox_processing_reclaimed_total");
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes("reclaimStaleProcessingOutboxRows")) {
  violations.push("outbox-relay.ts must reclaim stale processing before each tick");
}
if (!relay.includes('status: "processing", processedAt: new Date()')) {
  violations.push("outbox-relay.ts must set processedAt when marking processing");
}

const shutdown = read("src/server/graceful-shutdown.ts");
if (!shutdown.includes("drainOutboxRelayOnShutdown")) {
  violations.push("graceful-shutdown.ts must use drainOutboxRelayOnShutdown");
}

const worker = read("test/4-integration/graceful-shutdown-worker.ts");
if (
  !worker.includes("drainOutboxRelayOnShutdown") &&
  !worker.includes("installGracefulShutdownHandlers")
) {
  violations.push(
    "graceful-shutdown-worker.ts must use drainOutboxRelayOnShutdown or installGracefulShutdownHandlers (DEC-085)"
  );
}

const specPath = "src/outbox/outbox-processing-reclaim.spec.ts";
if (!fs.existsSync(path.join(ROOT, specPath))) {
  violations.push(`${specPath} must exist`);
}

if (violations.length > 0) {
  console.error("guard-outbox-processing-reclaim: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-processing-reclaim: PASS");
