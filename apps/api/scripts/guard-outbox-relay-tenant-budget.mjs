#!/usr/bin/env node
/**
 * SCAL-DEBT-10 / DEC-066 — outbox relay per-tenant in-flight publish budget.
 * @see docs/phase-5/appendices/outbox-relay-fairness.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const budget = read("src/outbox/outbox-relay-tenant-budget.ts");
if (!budget.includes("tryAcquireOutboxRelayTenantSlot")) {
  violations.push("outbox-relay-tenant-budget.ts must export tryAcquireOutboxRelayTenantSlot");
}
if (!budget.includes("resolveOutboxRelayMaxInFlightPerTenant")) {
  violations.push("outbox-relay-tenant-budget.ts must read OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT");
}
if (!budget.includes("outbox_relay_tenant_deferred_total")) {
  violations.push(
    "outbox-relay-tenant-budget.ts must increment outbox_relay_tenant_deferred_total"
  );
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes("tryAcquireOutboxRelayTenantSlot")) {
  violations.push("outbox-relay.ts must gate publish with tryAcquireOutboxRelayTenantSlot");
}
if (!relay.includes("markOutboxPending")) {
  violations.push("outbox-relay.ts must defer overflow rows via markOutboxPending");
}
if (!relay.includes("deferred")) {
  violations.push("outbox-relay.ts must report deferred count in OutboxRelayProcessResult");
}

if (violations.length > 0) {
  console.error("guard-outbox-relay-tenant-budget: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-relay-tenant-budget: PASS");
