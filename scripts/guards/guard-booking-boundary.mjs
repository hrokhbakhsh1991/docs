#!/usr/bin/env node
/**
 * Booking application boundary — Finance-core-style purity (Phase B1.9).
 * Scans the Booking application surface under apps/api/src/bookings (no package extract).
 *
 * @see docs/phase-20/p7/appendices/BOOKING_APPLICATION_PURITY_B1_9.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const BOOKINGS_ROOT = path.join(REPO_ROOT, "apps/api/src/bookings");

/** Application keep-list (B0.1 §6 / B1.9) — host/HTTP/persistence/composition excluded. */
const APPLICATION_REL_PATHS = Object.freeze([
  "bookings.service.ts",
  "bookings.types.ts",
  "bookings.errors.ts",
  "booking-payment-status.ts",
  "booking-list-query.ts",
  "bookings-member-summary-projection.ts",
  "ports/booking-actor-context.ts",
  "ports/booking-authorization.port.ts",
  "ports/booking-clock.port.ts",
  "ports/booking-public.port.ts",
  "ports/booking-repository.port.ts",
  "ports/booking-runtime-capabilities.port.ts",
  "ports/booking-tenant-workspace-binding.port.ts",
]);

/**
 * @typedef {{ re: RegExp, dependency: string, reason: string }} SpecRule
 * @typedef {{ re: RegExp, dependency: string, reason: string }} SymbolRule
 */

/** @type {SpecRule[]} */
const FORBIDDEN_SPEC_RULES = [
  {
    re: /^@prisma(\/|$)/,
    dependency: "@prisma/*",
    reason: "Prisma client must stay in Booking persistence / infrastructure",
  },
  {
    re: /^@app-tour\/workspace-/,
    dependency: "@app-tour/workspace-*",
    reason: "workspace packages implement adapters — application owns ports only",
  },
  {
    re: /^@app-tour\/workspace-sdk$/,
    dependency: "@app-tour/workspace-sdk",
    reason: "use BookingActorContext / ports — not workspace-sdk auth types",
  },
  {
    re: /(^|\/)packages\/workspaces\//,
    dependency: "packages/workspaces/*",
    reason: "workspace implementations must not enter Booking application",
  },
  {
    re: /\.generated(\.|$)/,
    dependency: "*.generated.*",
    reason: "generated workspace bindings are host/composition-owned",
  },
  {
    re: /^node:http$/,
    dependency: "node:http",
    reason: "HTTP handlers stay in bookings.routes / host",
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
    re: /^\.\.\/db(\/|$)/,
    dependency: "../db/*",
    reason: "database / RLS helpers are host infrastructure",
  },
  {
    re: /^\.\.\/http(\/|$)/,
    dependency: "../http/*",
    reason: "HTTP helpers are host infrastructure",
  },
  {
    re: /^\.\.\/outbox(\/|$)/,
    dependency: "../outbox/*",
    reason: "outbox enqueue / relay is host event infrastructure",
  },
  {
    re: /^\.\.\/storage(\/|$)/,
    dependency: "../storage/*",
    reason: "storage driver selection is host composition",
  },
  {
    re: /^\.\.\/identity(\/|$)/,
    dependency: "../identity/*",
    reason: "identity / session is host — inject BookingActorContext",
  },
  {
    re: /^\.\.\/middleware(\/|$)/,
    dependency: "../middleware/*",
    reason: "HTTP middleware is host",
  },
  {
    re: /^\.\/infrastructure(\/|$)/,
    dependency: "./infrastructure/*",
    reason: "host adapters must not be imported by application",
  },
  {
    re: /^\.\/create-bookings-service(\.ts)?$/,
    dependency: "./create-bookings-service",
    reason: "composition root / façades are host — not application",
  },
  {
    re: /^\.\/create-bookings-repository(\.ts)?$/,
    dependency: "./create-bookings-repository",
    reason: "repository factory is host composition",
  },
  {
    re: /^\.\/prisma-bookings\.repository(\.ts)?$/,
    dependency: "./prisma-bookings.repository",
    reason: "Prisma repository is persistence infrastructure",
  },
  {
    re: /^\.\/in-memory-bookings\.repository(\.ts)?$/,
    dependency: "./in-memory-bookings.repository",
    reason: "memory repository is persistence infrastructure",
  },
  {
    re: /^\.\/bookings\.routes(\.ts)?$/,
    dependency: "./bookings.routes",
    reason: "HTTP routes are not application",
  },
  {
    re: /^\.\/booking-dependency-registry(\.ts)?$/,
    dependency: "./booking-dependency-registry",
    reason: "capability registries are host composition",
  },
  {
    re: /^\.\/booking-event-reaction-registry(\.ts)?$/,
    dependency: "./booking-event-reaction-registry",
    reason: "capability registries are host composition",
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
    re: /\bconsole\.(log|info|warn|error|debug|trace)\b/,
    dependency: "console.*",
    reason: "logging is host — inject a logger port if needed",
  },
  {
    re: /\bwithTenantRls\b/,
    dependency: "withTenantRls",
    reason: "tenant RLS belongs in persistence infrastructure",
  },
  {
    re: /\benqueueOutboxEvent\b/,
    dependency: "enqueueOutboxEvent",
    reason: "outbox enqueue is host event infrastructure",
  },
  {
    re: /\bgetBookingsRepository\b/,
    dependency: "getBookingsRepository",
    reason: "service locator / factory — inject BookingRepositoryPort",
  },
  {
    re: /\bcreateBookingsRepository\b/,
    dependency: "createBookingsRepository",
    reason: "repository factory is host composition",
  },
  {
    re: /\bPrisma\.TransactionClient\b/,
    dependency: "Prisma.TransactionClient",
    reason: "Prisma TX stays in persistence adapters",
  },
  {
    re: /\bgetPrismaAdmin\b/,
    dependency: "getPrismaAdmin",
    reason: "Prisma admin client is host infrastructure",
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
    const rule = matchSpec(spec, FORBIDDEN_SPEC_RULES);
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
    const flags = rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`;
    const globalRe = new RegExp(rule.re.source, flags);
    let sm;
    while ((sm = globalRe.exec(text)) !== null) {
      addViolation(rel, lineAt(text, sm.index), rule.dependency, rule.reason);
    }
  }
}

/**
 * @param {string} label
 * @param {{ exitOnPass?: boolean }} [opts]
 */
function reportAndExit(label, opts = {}) {
  const exitOnPass = opts.exitOnPass !== false;
  if (violations.length > 0) {
    console.error(`guard-booking-boundary: FAIL (${label})`);
    console.error(`  ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  file:       ${v.file}:${v.line}`);
      console.error(`  dependency: ${v.dependency}`);
      console.error(`  reason:     ${v.reason}`);
      console.error("");
    }
    process.exit(1);
  }
  console.log(`guard-booking-boundary: PASS (${label})`);
  if (exitOnPass) {
    process.exit(0);
  }
}

const argv = process.argv.slice(2);
const scanFileIdx = argv.indexOf("--scan-file");
if (scanFileIdx !== -1) {
  const target = argv[scanFileIdx + 1];
  if (typeof target !== "string" || target.length === 0) {
    console.error("guard-booking-boundary: --scan-file requires a path");
    process.exit(1);
  }
  const abs = path.isAbsolute(target) ? target : path.join(REPO_ROOT, target);
  if (!fs.existsSync(abs)) {
    console.error(`guard-booking-boundary: FAIL — missing ${target}`);
    process.exit(1);
  }
  scanFile(abs, path.relative(REPO_ROOT, abs));
  reportAndExit(`scan-file ${path.relative(REPO_ROOT, abs)}`);
}

if (!fs.existsSync(BOOKINGS_ROOT)) {
  console.error("guard-booking-boundary: FAIL — apps/api/src/bookings missing");
  process.exit(1);
}

for (const rel of APPLICATION_REL_PATHS) {
  const abs = path.join(BOOKINGS_ROOT, rel);
  if (!fs.existsSync(abs)) {
    addViolation(rel, 1, "(missing file)", "application surface file required by B1.9 allowlist");
    continue;
  }
  scanFile(abs, path.join("apps/api/src/bookings", rel));
}

if (violations.length > 0) {
  reportAndExit("application surface");
}
console.log("guard-booking-boundary: PASS (application surface)");
console.log(`  scanned: ${APPLICATION_REL_PATHS.length} application file(s)`);
console.log("  allowed: relative application imports, @app-tour/booking-http-contracts");
