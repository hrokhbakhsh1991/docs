#!/usr/bin/env node
/**
 * DEC-087 — ordered per-tenant outbox claim wiring lock.
 * @see docs/phase-5/appendices/outbox-relay-ordered-per-tenant.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const config = read("src/outbox/outbox-relay-config.ts");
if (!config.includes("isOutboxRelayOrderedPerTenant")) {
  violations.push("outbox-relay-config.ts must export isOutboxRelayOrderedPerTenant");
}
if (!config.includes("OUTBOX_RELAY_ORDERED_PER_TENANT")) {
  violations.push("outbox-relay-config.ts must read OUTBOX_RELAY_ORDERED_PER_TENANT");
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes("isOutboxRelayOrderedPerTenant")) {
  violations.push("outbox-relay.ts must use isOutboxRelayOrderedPerTenant");
}
if (!relay.includes("NOT EXISTS")) {
  violations.push("outbox-relay.ts must add NOT EXISTS processing guard when ordered");
}

if (!exists("test/4-integration/outbox-relay-ordered-per-tenant.spec.ts")) {
  violations.push("outbox-relay-ordered-per-tenant.spec.ts must exist");
}

if (violations.length > 0) {
  console.error("guard-outbox-relay-ordered-per-tenant: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-relay-ordered-per-tenant: PASS");
