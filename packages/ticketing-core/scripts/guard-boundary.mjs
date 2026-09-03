#!/usr/bin/env node
/**
 * ticketing-core boundary — package-local hard isolation (Phase 2B).
 * Allowed import specs: relative (self) only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const CORE_SRC = path.join(PKG_ROOT, "src");

/** @typedef {{ re: RegExp, dependency: string, reason: string }} SpecRule */
/** @typedef {{ re: RegExp, dependency: string, reason: string }} SymbolRule */

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
    reason: "ticketing-core must not import the API package",
  },
  {
    re: /(^|\/)apps\/api(\/|$)/,
    dependency: "apps/api",
    reason: "ticketing-core must not import host application paths",
  },
  {
    re: /^@app-tour\/ticketing-http-contracts(\/|$)/,
    dependency: "@app-tour/ticketing-http-contracts",
    reason: "HTTP contracts are an outer layer; core must not depend on them",
  },
  {
    re: /^@app-tour\/finance-core(\/|$)/,
    dependency: "@app-tour/finance-core",
    reason: "ticketing-core is a separate bounded context from finance-core",
  },
  {
    re: /^@app-tour\/workspace-/,
    dependency: "@app-tour/workspace-*",
    reason: "workspace packages implement adapters; core owns ports only",
  },
  {
    re: /^@app-tour\/workspace-sdk$/,
    dependency: "@app-tour/workspace-sdk",
    reason: "ticketing-core must remain workspace-agnostic",
  },
  {
    re: /(^|\/)packages\/workspaces\//,
    dependency: "packages/workspaces/*",
    reason: "workspace implementations must not enter ticketing-core",
  },
  {
    re: /(^|\/)apps\/(portal|web|marketing)(\/|$)/,
    dependency: "apps/portal|web|marketing",
    reason: "UI packages must not enter ticketing-core",
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
    re: /\bPrisma\.TransactionClient\b/,
    dependency: "Prisma.TransactionClient",
    reason: "Prisma TX stays in adapters",
  },
];

const STATIC_IMPORT_RE = /(?:from\s+|require\s*\()\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const SIDE_EFFECT_IMPORT_RE = /^import\s+["']([^"']+)["']/gm;

/** @typedef {{ file: string, line: number, dependency: string, reason: string }} Violation */

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
        rule.reason,
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
        rule.reason,
      );
    }
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(text)) !== null) {
    const spec = m[1];
    const rule = matchSpec(spec, FORBIDDEN_SPEC_RULES);
    if (rule !== null) {
      addViolation(
        rel,
        lineAt(text, m.index),
        `${rule.dependency} (dynamic import("${spec}"))`,
        `${rule.reason} (dynamic import)`,
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
  console.error("guard-ticketing-core-boundary: FAIL — packages/ticketing-core/src missing");
  process.exit(1);
}

walk(CORE_SRC);

if (violations.length > 0) {
  console.error("guard-ticketing-core-boundary: FAIL");
  console.error(`  ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  file:       ${v.file}:${v.line}`);
    console.error(`  dependency: ${v.dependency}`);
    console.error(`  reason:     ${v.reason}`);
    console.error("");
  }
  process.exit(1);
}

console.log("guard-ticketing-core-boundary: PASS");
console.log("  scanned: src (package-local)");
console.log("  allowed: self (relative imports only)");
