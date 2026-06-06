#!/usr/bin/env node
/**
 * DEC-111 — relay / poll exponential backoff wiring lock.
 * @see docs/phase-5/appendices/relay-backoff-jitter.md
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

for (const rel of [
  "src/resilience/compute-relay-backoff.ts",
  "src/resilience/compute-relay-backoff.spec.ts",
]) {
  if (!exists(rel)) {
    violations.push(`${rel} must exist`);
  }
}

const backoff = read("src/resilience/compute-relay-backoff.ts");
if (!backoff.includes("computeRelayBackoff")) {
  violations.push("compute-relay-backoff.ts must export computeRelayBackoff");
}
if (!backoff.includes("readHttpIdempotencyPollBaseMs")) {
  violations.push("compute-relay-backoff.ts must export idempotency poll env readers");
}

const relayStart = read("src/outbox/start-outbox-relay.ts");
if (!relayStart.includes("computeRelayBackoff")) {
  violations.push("start-outbox-relay.ts must use computeRelayBackoff");
}
if (relayStart.includes("setInterval(tick")) {
  violations.push("start-outbox-relay.ts must not use fixed setInterval for relay ticks");
}
if (!relayStart.includes("setTimeout")) {
  violations.push("start-outbox-relay.ts must schedule ticks with setTimeout");
}

const reclaim = read("src/outbox/outbox-processing-reclaim.ts");
if (!reclaim.includes("computeRelayBackoff")) {
  violations.push("outbox-processing-reclaim.ts drain must use computeRelayBackoff");
}

const idempotency = read("src/http/http-idempotency.ts");
if (!idempotency.includes("computeRelayBackoff")) {
  violations.push("http-idempotency.ts must use computeRelayBackoff for wait polls");
}
if (idempotency.includes("POLL_INTERVAL_MS")) {
  violations.push("http-idempotency.ts must not use fixed POLL_INTERVAL_MS");
}

const pkg = read("package.json");
if (!pkg.includes("guard:relay-backoff")) {
  violations.push("package.json must define guard:relay-backoff");
}

if (violations.length > 0) {
  console.error("guard-relay-backoff: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-relay-backoff: PASS");
