#!/usr/bin/env node
/**
 * DEC-086 — outbox failed replay wiring lock.
 * @see docs/phase-5/appendices/outbox-failed-replay.md
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
  "src/outbox/outbox-failed.ts",
  "src/outbox/outbox-replay.ts",
  "src/outbox/outbox-prod-replay.ts",
  "src/outbox/outbox-replay-audit.ts",
  "src/routes/internal/outbox-replay.ts",
  "scripts/outbox-replay-failed.mjs",
  "test/4-integration/outbox-failed-replay.spec.ts",
]) {
  if (!exists(rel)) {
    violations.push(`${rel} must exist`);
  }
}

const failed = read("src/outbox/outbox-failed.ts");
if (!failed.includes("markOutboxFailed")) {
  violations.push("outbox-failed.ts must export markOutboxFailed");
}
if (!failed.includes("lastError")) {
  violations.push("outbox-failed.ts must persist lastError");
}

const replay = read("src/outbox/outbox-replay.ts");
if (!replay.includes("replayFailedOutboxEvent")) {
  violations.push("outbox-replay.ts must export replayFailedOutboxEvent");
}
if (!replay.includes("tryReplayFailedOutboxEvent")) {
  violations.push("outbox-replay.ts must export tryReplayFailedOutboxEvent");
}
if (replay.includes("assertProvisioningDevelopmentOnly")) {
  violations.push("outbox-replay core must not embed provisioning gate (Phase 3.17 edge auth)");
}

const prod = read("src/outbox/outbox-prod-replay.ts");
if (!prod.includes("runOutboxProdReplay")) {
  violations.push("outbox-prod-replay.ts must export runOutboxProdReplay");
}
if (!prod.includes("OUTBOX_REPLAY_CONFIRM_PHRASE")) {
  violations.push("outbox-prod-replay.ts must define confirm phrase");
}

const route = read("src/routes/internal/outbox-replay.ts");
if (!route.includes("OPS_SCOPE_OUTBOX_REPLAY")) {
  violations.push("outbox-replay route must define OPS_SCOPE_OUTBOX_REPLAY");
}
if (!route.includes("handleInternalOutboxReplay")) {
  violations.push("outbox-replay route must export handleInternalOutboxReplay");
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes('from "./outbox-failed"')) {
  violations.push("outbox-relay.ts must use markOutboxFailed from outbox-failed");
}

const app = read("src/app.ts");
if (!app.includes("handleReplayOutbox") || !app.includes("outboxReplayMatch")) {
  violations.push("app.ts must wire POST /internal/outbox/:id/replay via handleReplayOutbox");
}

const schema = read("prisma/schema.prisma");
if (!schema.includes("lastError")) {
  violations.push("schema.prisma must define OutboxEvent.lastError");
}

const pkg = read("package.json");
if (!pkg.includes("outbox:replay-failed")) {
  violations.push("package.json must define outbox:replay-failed");
}

if (violations.length > 0) {
  console.error("guard-outbox-failed-replay: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-failed-replay: PASS");
