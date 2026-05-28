#!/usr/bin/env node
/**
 * CI: enforce append-only ledger discipline.
 *
 * 1) `modules/finance/ledger` (non-spec): no TypeORM-style mutate/delete calls on ledger code paths.
 * 2) Migrations: if they reference `ledger_journal_lines`, forbid UPDATE/DELETE/clearTable against it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LEDGER_MODULE = path.join(REPO_ROOT, "apps/api/src/modules/finance/ledger");
const MIGRATIONS = path.join(REPO_ROOT, "apps/api/src/database/migrations");

const TABLE_TOKEN = "ledger_journal_lines";

const FORBIDDEN_IN_LEDGER_MODULE = [
  { re: /\.\s*update\s*\(/, msg: ".update( — ledger rows must not be updated in place" },
  { re: /\.\s*delete\s*\(/, msg: ".delete( — ledger rows must not be deleted in place" },
  { re: /\.\s*softDelete\s*\(/, msg: ".softDelete( — ledger rows must not be soft-deleted" },
  { re: /\.\s*softRemove\s*\(/, msg: ".softRemove( — ledger rows must not be soft-removed" },
  { re: /\.\s*remove\s*\(/, msg: ".remove( — ledger rows must not be removed via ORM" }
];

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function stripTsComments(text) {
  let s = text.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/^\s*\/\/.*$/gm, "");
  return s;
}

function walkTsFiles(dir, { specs = false } = {}) {
  const acc = [];
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      acc.push(...walkTsFiles(p, { specs }));
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      if (!specs && ent.name.endsWith(".spec.ts")) continue;
      acc.push(p);
    }
  }
  return acc;
}

function checkLedgerModule() {
  const violations = [];
  if (!fs.existsSync(LEDGER_MODULE)) return violations;
  for (const abs of walkTsFiles(LEDGER_MODULE, { specs: false })) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    const raw = fs.readFileSync(abs, "utf8");
    const text = stripTsComments(raw);
    for (const { re, msg } of FORBIDDEN_IN_LEDGER_MODULE) {
      re.lastIndex = 0;
      if (re.test(text)) {
        violations.push(`${rel}: ${msg}`);
        break;
      }
    }
  }
  return violations;
}

function checkMigrations() {
  const violations = [];
  if (!fs.existsSync(MIGRATIONS)) return violations;
  for (const abs of walkTsFiles(MIGRATIONS, { specs: true })) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    const text = fs.readFileSync(abs, "utf8");
    if (!text.includes(TABLE_TOKEN)) continue;
    const t = text.replace(/\s+/g, " ");
    if (/\bUPDATE\s+[`'"]?ledger_journal_lines/i.test(t)) {
      violations.push(`${rel}: UPDATE on ${TABLE_TOKEN} — append-only; use new rows / reversals`);
    }
    if (/\bDELETE\s+FROM\s+[`'"]?ledger_journal_lines/i.test(t)) {
      violations.push(`${rel}: DELETE FROM ${TABLE_TOKEN} — append-only; no row deletes`);
    }
    if (new RegExp(`clearTable\\s*\\(\\s*['\`]${TABLE_TOKEN}['\`]`, "i").test(text)) {
      violations.push(`${rel}: clearTable(${TABLE_TOKEN}) — forbidden for append-only ledger`);
    }
  }
  return violations;
}

function main() {
  const violations = [...checkLedgerModule(), ...checkMigrations()];
  if (violations.length) {
    process.exit(1);
  }
}

main();
