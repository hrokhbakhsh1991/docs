#!/usr/bin/env node
/**
 * finance-core boundary — package-local hard isolation (Phase 2.3).
 * Allowed import specs: relative (self), node:crypto, @app-tour/finance-http-contracts
 *
 * @see docs/phase-20/p7/appendices/FINANCE_PLATFORM_EVOLUTION_PLAN.md Phase 2.3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const CORE_SRC = path.join(PKG_ROOT, "src");

/**
 * @typedef {{ re: RegExp, dependency: string, reason: string }} SpecRule
 * @typedef {{ re: RegExp, dependency: string, reason: string }} SymbolRule
 */

/** @type {SpecRule[]} */
const FORBIDDEN_SPEC_RULES = [
  {
    re: /^@prisma(\/|$)/,
    dependency: "@prisma/*",
    reason: "Prisma client must stay in apps/api infrastructure",
  },
  {
    re: /^@apps\/api\b/,
    dependency: "@apps/api",
    reason: "finance-core must not import the API package",
  },
  {
    re: /(^|\/)apps\/api(\/|$)/,
    dependency: "apps/api",
    reason: "finance-core must not import host application paths",
  },
  {
    re: /^@app-tour\/workspace-/,
    dependency: "@app-tour/workspace-*",
    reason: "workspace packages implement adapters; core owns ports only",
  },
  {
    re: /^@app-tour\/workspace-sdk$/,
    dependency: "@app-tour/workspace-sdk",
    reason: "use FinanceActorContext / ports — not workspace-sdk auth types",
  },
  {
    re: /(^|\/)packages\/workspaces\//,
    dependency: "packages/workspaces/*",
    reason: "workspace implementations must not enter finance-core",
  },
  {
    re: /\.generated(\.|$)/,
    dependency: "*.generated.*",
    reason: "generated workspace bindings are host/composition-owned",
  },
  {
    re: /^node:fs$/,
    dependency: "node:fs",
    reason: "filesystem access is host infrastructure",
  },
  {
    re: /^fs$/,
    dependency: "fs",
    reason: "filesystem access is host infrastructure",
  },
  {
    re: /^fs\//,
    dependency: "fs/*",
    reason: "filesystem access is host infrastructure",
  },
];

const DYNAMIC_FORBIDDEN = FORBIDDEN_SPEC_RULES;

/** @type {SymbolRule[]} */
const FORBIDDEN_SYMBOL_RULES = [
  {
    re: /\bprocess\.env\b/,
    dependency: "process.env",
    reason: "environment access is host composition — inject ports instead",
  },
  {
    re: /\bwithTenantRls\b/,
    dependency: "withTenantRls",
    reason: "tenant RLS belongs in apps/api database infrastructure",
  },
  {
    re: /\benqueueOutboxEvent\b/,
    dependency: "enqueueOutboxEvent",
    reason: "outbox enqueue is host event infrastructure",
  },
  {
    re: /\bHostIo\b/,
    dependency: "HostIo",
    reason: "HostIo is apps/api composition / reaction wiring",
  },
  {
    re: /\bPrisma\.TransactionClient\b/,
    dependency: "Prisma.TransactionClient",
    reason: "use opaque FinanceTransactionPort — Prisma TX stays in adapters",
  },
  {
    re: /\bPrismaFinanceRepository\b/,
    dependency: "PrismaFinanceRepository",
    reason: "Prisma repository implementation must stay in apps/api",
  },
  {
    re: /\bprisma-workspace-outbox\b/,
    dependency: "prisma-workspace-outbox",
    reason: "TX-scoped outbox writer is host infrastructure",
  },
];

const STATIC_IMPORT_RE = /(?:from\s+|require\s*\()\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const SIDE_EFFECT_IMPORT_RE = /^import\s+["']([^"']+)["']/gm;

/**
 * @typedef {{ file: string, line: number, dependency: string, reason: string }} Violation
 */

/** @type {Violation[]} */
const violations = [];

/**
 * @param {string} file
 * @param {number} line
 * @param {string} dependency
 * @param {string} reason
 */
function addViolation(file, line, dependency, reason) {
  violations.push({ file, line, dependency, reason });
}

/**
 * @param {string} spec
 * @param {SpecRule[]} rules
 * @returns {SpecRule | null}
 */
function matchSpec(spec, rules) {
  for (const rule of rules) {
    if (rule.re.test(spec)) return rule;
  }
  return null;
}

/**
 * @param {string} text
 * @param {number} index
 */
function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * @param {string} absPath
 * @param {string} rel
 */
function scanFile(absPath, rel) {
  const text = fs.readFileSync(absPath, "utf8");

  STATIC_IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = STATIC_IMPORT_RE.exec(text)) !== null) {
    const spec = m[1];
    const rule = matchSpec(spec, FORBIDDEN_SPEC_RULES);
    if (rule !== null) {
      addViolation(
        rel,
        lineAt(text, m.index),
        `${rule.dependency} (import "${spec}")`,
        rule.reason
      );
    }
  }

  SIDE_EFFECT_IMPORT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_IMPORT_RE.exec(text)) !== null) {
    const spec = m[1];
    const rule = matchSpec(spec, FORBIDDEN_SPEC_RULES);
    if (rule !== null) {
      addViolation(
        rel,
        lineAt(text, m.index),
        `${rule.dependency} (import "${spec}")`,
        rule.reason
      );
    }
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(text)) !== null) {
    const spec = m[1];
    const rule = matchSpec(spec, DYNAMIC_FORBIDDEN);
    if (rule !== null) {
      addViolation(
        rel,
        lineAt(text, m.index),
        `${rule.dependency} (dynamic import("${spec}"))`,
        `${rule.reason} (dynamic import)`
      );
    }
  }

  for (const rule of FORBIDDEN_SYMBOL_RULES) {
    rule.re.lastIndex = 0;
    const flags = rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`;
    const globalRe = new RegExp(rule.re.source, flags);
    let sm;
    while ((sm = globalRe.exec(text)) !== null) {
      addViolation(rel, lineAt(text, sm.index), rule.dependency, rule.reason);
    }
  }
}

/**
 * @param {string} dir
 */
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.ts$/.test(ent.name) || ent.name.endsWith(".spec.ts")) continue;
    scanFile(p, path.relative(PKG_ROOT, p));
  }
}

if (!fs.existsSync(CORE_SRC)) {
  console.error("guard-finance-core-boundary: FAIL — packages/finance-core/src missing");
  process.exit(1);
}

walk(CORE_SRC);

if (violations.length > 0) {
  console.error("guard-finance-core-boundary: FAIL");
  console.error(`  ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  file:       ${v.file}:${v.line}`);
    console.error(`  dependency: ${v.dependency}`);
    console.error(`  reason:     ${v.reason}`);
    console.error("");
  }
  process.exit(1);
}

console.log("guard-finance-core-boundary: PASS");
console.log("  scanned: src (package-local)");
console.log("  allowed: self (relative), node:crypto, @app-tour/finance-http-contracts");
