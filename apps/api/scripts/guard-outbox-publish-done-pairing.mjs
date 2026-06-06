#!/usr/bin/env node
/**
 * DEC-072 / Phase 4 step 2 — publish / mark-done pairing + OZ-02 heal.
 * @see docs/phase-5/appendices/outbox-publish-done-pairing.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const markDone = read("src/outbox/outbox-mark-done.ts");
if (!markDone.includes("markOutboxDoneWithRetry")) {
  violations.push("outbox-mark-done.ts must export markOutboxDoneWithRetry");
}
if (!markDone.includes('status: "processing"') && !markDone.includes("status = 'processing'")) {
  violations.push("outbox-mark-done.ts must guard mark-done with status=processing");
}
if (!markDone.includes("OutboxMarkDoneAfterPublishError")) {
  violations.push("outbox-mark-done.ts must define OutboxMarkDoneAfterPublishError");
}
if (!markDone.includes("outbox_publish_done_pairing_gap_total")) {
  violations.push("outbox-mark-done.ts must increment outbox_publish_done_pairing_gap_total");
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes("markOutboxDoneWithRetry")) {
  violations.push("outbox-relay.ts must call markOutboxDoneWithRetry after publish");
}
if (!relay.includes("OutboxMarkDoneAfterPublishError")) {
  violations.push(
    "outbox-relay.ts must handle OutboxMarkDoneAfterPublishError without marking failed"
  );
}

const reclaim = read("src/outbox/outbox-processing-reclaim.ts");
if (!reclaim.includes("healPublishedProcessingOutboxRows")) {
  violations.push("outbox-processing-reclaim.ts must heal OZ-02 before pending reclaim");
}
if (!reclaim.includes("processed_domain_events")) {
  violations.push("outbox-processing-reclaim.ts must join processed_domain_events for heal");
}
if (!reclaim.includes("outbox_publish_done_healed_total")) {
  violations.push("outbox-processing-reclaim.ts must increment outbox_publish_done_healed_total");
}

const specPath = "src/outbox/outbox-publish-done-pairing.spec.ts";
if (!fs.existsSync(path.join(ROOT, specPath))) {
  violations.push(`${specPath} must exist`);
}

if (violations.length > 0) {
  console.error("guard-outbox-publish-done-pairing: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-publish-done-pairing: PASS");
