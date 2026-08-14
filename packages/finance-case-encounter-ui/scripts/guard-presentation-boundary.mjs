#!/usr/bin/env node
/**
 * PR8-B — presentation boundary guard.
 * UI sources must not import CaseOutput, FactSnapshot, finance rules, or SoT services.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const FORBIDDEN_IMPORT =
  /from\s+["'][^"']*(FactSnapshot|CaseOutput|interpretFinanceCase|assembleCaseFactSnapshot|executeFinanceCase|\/rules\/|FinanceService|prisma)[^"']*["']/;
const FORBIDDEN_PACKAGE =
  /from\s+["']@app-tour\/finance-core["']|from\s+["']@app-tour\/workspace-|from\s+["'][^"']*workspaces\/denali/;

const errors = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const text = fs.readFileSync(full, "utf8");
    const importLines = text.split("\n").filter((line) => /\bfrom\s+["']/.test(line) || /^\s*import\s+["']/.test(line));
    for (const line of importLines) {
      if (FORBIDDEN_IMPORT.test(line) || FORBIDDEN_PACKAGE.test(line)) {
        errors.push(`${path.relative(ROOT, full)}: ${line.trim()}`);
      }
    }
    // SoT invoke tokens — capability metadata may name commands without calling them.
    if (/createManualPayment\s*\(|reviewReceipt\s*\(|approveReceipt\s*\(/.test(text)) {
      errors.push(`${path.relative(ROOT, full)}: mutation/command invoke`);
    }
    if (/from\s+["'][^"']*FinanceService[^"']*["']/.test(text)) {
      errors.push(`${path.relative(ROOT, full)}: FinanceService import`);
    }
  }
}

walk(SRC);

if (errors.length > 0) {
  console.error("guard-presentation-boundary: FAIL");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log("guard-presentation-boundary: PASS");
