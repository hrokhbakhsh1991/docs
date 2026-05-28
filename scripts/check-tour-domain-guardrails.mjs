#!/usr/bin/env node
/**
 * Tour domain architecture guardrails for CI.
 *
 * Closes the residual hole flagged in `promptq.md` Phase P2: ESLint already forbids legacy
 * `EventKind` symbols in the wizard scope, but the **API tours module** has no static linter.
 * This script greps the api `tours` source tree and fails the build if a forbidden symbol
 * appears anywhere — defensive net for refactors that re-introduce dual classification.
 *
 * Mirrors the style of `scripts/check-tenant-isolation-guardrails.mjs`.
 *
 * Checks:
 * 1) `apps/api/src/modules/tours/**` must not import or reference any legacy `EventKind`
 *    symbol (`EventKind`, `EventKindResolverInput`, `resolveEventKindFromTourContext`,
 *    `eventKindForDomainProfile`, `domainProfileFromEventKindBestEffort`).
 * 2) `apps/web/src/features/tours/wizard/**` is already lint-guarded via `.eslintrc.json`,
 *    but this script double-checks for parity (cheap belt-and-suspenders).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_SYMBOLS = [
  "EventKind",
  "EventKindResolverInput",
  "resolveEventKindFromTourContext",
  "eventKindForDomainProfile",
  "domainProfileFromEventKindBestEffort",
];

// Self-referential files: fitness specs that LIST the forbidden symbols as string literals.
// Excluding them is safe because each such file lives next to the rule it enforces and is
// covered by independent peer review when added.
const SELF_REFERENTIAL_FITNESS_FILES = new Set([
  "apps/api/src/modules/tours/fitness.spec.ts",
]);

const SCOPES = [
  {
    label: "apps/api tours module",
    root: path.join(REPO_ROOT, "apps/api/src/modules/tours"),
    extensions: [".ts"],
    ignoredFileSuffixes: [".d.ts"],
  },
  {
    label: "apps/web wizard scope",
    root: path.join(REPO_ROOT, "apps/web/src/features/tours/wizard"),
    extensions: [".ts", ".tsx"],
    ignoredFileSuffixes: [".d.ts"],
  },
];

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".next") continue;
      walk(p, exts, acc);
    } else if (ent.isFile() && exts.some((ext) => ent.name.endsWith(ext))) {
      acc.push(p);
    }
  }
  return acc;
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

// Strip line- and block- comments from TypeScript source so the symbol scan does not flag
// legitimate documentation that names the legacy symbols (e.g. recipe blocks in
// `profileRules/rules.ts`). Naive but sufficient — does not need to be lossless; we only
// care about whether a forbidden identifier appears in **code**.
function stripComments(source) {
  // Remove block comments (non-greedy).
  let out = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments (full line or end-of-line).
  out = out.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return out;
}

function scanScope({ label, root, extensions, ignoredFileSuffixes }) {
  const files = walk(root, extensions).filter(
    (p) => !ignoredFileSuffixes.some((suffix) => p.endsWith(suffix)),
  );
  const violations = [];
  for (const abs of files) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (SELF_REFERENTIAL_FITNESS_FILES.has(rel)) continue;
    const text = stripComments(fs.readFileSync(abs, "utf8"));
    for (const symbol of FORBIDDEN_SYMBOLS) {
      const re = new RegExp(`\\b${symbol}\\b`);
      if (re.test(text)) {
        violations.push({ scope: label, file: rel, symbol });
      }
    }
  }
  return violations;
}

let allViolations = [];
for (const scope of SCOPES) {
  allViolations = allViolations.concat(scanScope(scope));
}

if (allViolations.length === 0) {
  process.exit(0);
}

for (const _v of allViolations) {
}
process.exit(1);
