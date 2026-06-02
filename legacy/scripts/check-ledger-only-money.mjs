#!/usr/bin/env node
/**
 * CI: registration `paid_amount` must not be assigned outside BookingLedgerAuthorityService
 * (ledger-first projection model).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

const ALLOW_FILES = new Set([
  "apps/api/src/modules/finance/ledger/booking-ledger-authority.service.ts",
  "apps/api/src/modules/registrations/repositories/registration-finance-port.adapters.ts",
]);

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walkTs(p, acc);
    } else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

const reAssignment = /\.paidAmount\s*=/g;

function main() {
  const violations = [];
  for (const abs of walkTs(API_SRC)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (ALLOW_FILES.has(rel)) continue;
    const text = fs.readFileSync(abs, "utf8");
    let m;
    reAssignment.lastIndex = 0;
    while ((m = reAssignment.exec(text)) !== null) {
      const line = text.slice(0, m.index).split("\n").length;
      violations.push(`${rel}:${line}: direct .paidAmount assignment — use BookingLedgerAuthorityService`);
    }
  }
  reportAndExit("check-ledger-only-money", violations);
}

try {
  main();
} catch (err) {
  reportFatal("check-ledger-only-money", err);
}
