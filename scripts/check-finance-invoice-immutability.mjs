#!/usr/bin/env node
/**
 * CI: `finance/invoicing` is a **pure derived-artifact** zone — invoices must not mutate financial state.
 *
 * Forbid Nest persistence / outbox side effects in non-spec files under `apps/api/src/modules/finance/invoicing`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const INVOICE_SRC = path.join(REPO_ROOT, "apps/api/src/modules/finance/invoicing");

function stripTsComments(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/^\s*\/\/.*$/gm, "");
  return s;
}

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

const FORBIDDEN = [
  { re: /@Injectable\b/, msg: "@Injectable — invoicing must stay free of Nest service writers" },
  { re: /\bOutboxService\b/, msg: "OutboxService — invoices cannot enqueue domain/outbox events" },
  { re: /\benqueueOutboxEvent\b/, msg: "enqueueOutboxEvent — invoicing must not write outbox rows" },
  { re: /\baddEvent\s*\(/, msg: "addEvent( — invoicing must not call transactional outbox" },
  { re: /@InjectRepository\b/, msg: "@InjectRepository — invoicing must not touch ORM repositories" },
  { re: /\bTypeOrmModule\b/, msg: "TypeOrmModule — invoicing must not register persistence" },
  { re: /\bDataSource\b/, msg: "DataSource — invoicing must not open DB transactions" },
  { re: /\.transaction\s*\(/, msg: ".transaction( — invoicing must not run DB transactions" }
];

function main() {
  const violations = [];
  for (const abs of walkTs(INVOICE_SRC)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    const text = stripTsComments(fs.readFileSync(abs, "utf8"));
    for (const { re, msg } of FORBIDDEN) {
      re.lastIndex = 0;
      if (re.test(text)) {
        violations.push(`${rel}: ${msg}`);
        break;
      }
    }
  }
  reportAndExit("check-finance-invoice-immutability", violations);
}

try {
  main();
} catch (err) {
  reportFatal("check-finance-invoice-immutability", err);
}
