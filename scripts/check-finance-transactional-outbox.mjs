#!/usr/bin/env node
/**
 * CI: finance code must not call `enqueueOutboxEvent` directly — use {@link OutboxService#addEvent}
 * on the same `EntityManager` as domain writes (transactional outbox, metrics, stable contract).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FINANCE_SRC = path.join(REPO_ROOT, "apps/api/src/modules/finance");

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walkTs(p, acc);
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

const RE_IMPORT_ENQUEUE = /\bfrom\s+['"][^'"]*enqueue-outbox-event['"]/;
const RE_CALL_ENQUEUE = /\benqueueOutboxEvent\s*\(/;

function main() {
  const violations = [];
  for (const abs of walkTs(FINANCE_SRC)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    const text = fs.readFileSync(abs, "utf8");
    if (RE_IMPORT_ENQUEUE.test(text)) {
      violations.push(`${rel}: import enqueue-outbox-event — use OutboxService.addEvent from finance`);
    }
    if (RE_CALL_ENQUEUE.test(text)) {
      violations.push(`${rel}: direct enqueueOutboxEvent( — use OutboxService.addEvent`);
    }
  }
  if (violations.length) {
    process.exit(1);
  }
}

main();
