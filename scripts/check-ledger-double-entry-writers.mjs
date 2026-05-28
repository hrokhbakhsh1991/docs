#!/usr/bin/env node
/**
 * CI: `postDoubleEntryJournal(` must only appear in the journal primitive module, booking authority,
 * and tests — prevents reintroducing single-sided `recordLedgerTransaction` style writers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

const CALL_RE = /\bpostDoubleEntryJournal\s*\(/;

const ALLOW_NON_SPEC = new Set([
  "apps/api/src/modules/finance/ledger/post-double-entry-journal.ts",
  "apps/api/src/modules/finance/ledger/booking-ledger-authority.service.ts",
  "apps/api/src/modules/finance/ledger/payment-refund-ledger-authority.service.ts"
]);

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

function main() {
  const violations = [];
  for (const abs of walkTs(API_SRC)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (rel.endsWith(".spec.ts")) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (!CALL_RE.test(text)) continue;
    if (ALLOW_NON_SPEC.has(rel)) continue;
    violations.push(`${rel}: postDoubleEntryJournal( — use BookingLedgerAuthorityService or add allowlist`);
  }
  if (violations.length) {
    process.exit(1);
  }
}

main();
