#!/usr/bin/env node
/**
 * DEC-110 — outbox transient auto-retry before terminal failed.
 * @see docs/phase-5/appendices/outbox-publish-auto-retry.md
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
  "src/outbox/outbox-publish-error-classifier.ts",
  "src/outbox/outbox-publish-error-classifier.spec.ts",
]) {
  if (!exists(rel)) {
    violations.push(`${rel} must exist`);
  }
}

const classifier = read("src/outbox/outbox-publish-error-classifier.ts");
if (!classifier.includes("classifyOutboxPublishError")) {
  violations.push("outbox-publish-error-classifier.ts must export classifyOutboxPublishError");
}
if (!classifier.includes("OUTBOX_TENANT_PAYLOAD_MISMATCH")) {
  violations.push("classifier must treat OUTBOX_TENANT_PAYLOAD_MISMATCH as poison");
}

const config = read("src/outbox/outbox-relay-config.ts");
if (!config.includes("readOutboxPublishMaxAttempts")) {
  violations.push("outbox-relay-config.ts must export readOutboxPublishMaxAttempts");
}
if (!config.includes("OUTBOX_PUBLISH_MAX_ATTEMPTS")) {
  violations.push("outbox-relay-config.ts must read OUTBOX_PUBLISH_MAX_ATTEMPTS");
}

const failed = read("src/outbox/outbox-failed.ts");
if (!failed.includes("markOutboxPendingForRetry")) {
  violations.push("outbox-failed.ts must export markOutboxPendingForRetry");
}
if (!failed.includes("parseOutboxPublishAttempts")) {
  violations.push("outbox-failed.ts must export parseOutboxPublishAttempts");
}

const relay = read("src/outbox/outbox-relay.ts");
if (!relay.includes("classifyOutboxPublishError")) {
  violations.push("outbox-relay.ts must classify publish errors before markOutboxFailed");
}
if (!relay.includes("markOutboxPendingForRetry")) {
  violations.push("outbox-relay.ts must defer transient failures via markOutboxPendingForRetry");
}
if (!relay.includes("readOutboxPublishMaxAttempts")) {
  violations.push("outbox-relay.ts must respect OUTBOX_PUBLISH_MAX_ATTEMPTS");
}
if (!relay.includes('last_error AS "lastError"')) {
  violations.push("outbox-relay.ts must select last_error when claiming pending rows");
}

const pkg = read("package.json");
if (!pkg.includes("guard:outbox-auto-retry")) {
  violations.push("package.json must define guard:outbox-auto-retry");
}

if (violations.length > 0) {
  console.error("guard-outbox-auto-retry: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-auto-retry: PASS");
