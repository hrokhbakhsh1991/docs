#!/usr/bin/env node
/**
 * Infrastructure closure — automated debt scan (Phase 4).
 *
 * Fails CI when unallowlisted matches are found for:
 * - legacy tenant resolver patterns
 * - browser-direct Nest API calls (apiClient usage outside BFF)
 * - generic `throw new Error` in core auth/BFF/tenant paths
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(__dirname, "infrastructure-debt.allowlist.json");

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function readAllowlist() {
  return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
}

function walk(dir, acc = [], ext = ".ts") {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".next") continue;
      walk(p, acc, ext);
    } else if (ent.isFile() && (ext === ".ts" ? ent.name.endsWith(".ts") || ent.name.endsWith(".tsx") : ent.name.endsWith(ext))) {
      acc.push(p);
    }
  }
  return acc;
}

function lineAt(src, idx) {
  return src.slice(0, idx).split("\n").length;
}

/** Removed helpers — must not reappear. */
function checkLegacyTenantResolvers(allow) {
  const banned = [
    { re: /resolve-tenant-context-helpers/g, label: "resolve-tenant-context-helpers" },
    { re: /\bfallbackTenant(?:Slug|Id)?\s*=/g, label: "fallbackTenant assignment" },
    { re: /\bdefaultTenant(?:Slug|Id)?\s*=/g, label: "defaultTenant assignment" },
    { re: /['"]default['"]\s*as\s+tenant/gi, label: "default-as-tenant literal" },
  ];
  const roots = [
    path.join(REPO_ROOT, "apps/web/lib/tenant"),
    path.join(REPO_ROOT, "apps/web/middleware.ts"),
    path.join(REPO_ROOT, "apps/api/src/common/tenant"),
  ];
  const allowed = new Set((allow.legacyTenantResolverPaths ?? []).map(normPosix));
  const violations = [];

  for (const root of roots) {
    const files = fs.existsSync(root) && fs.statSync(root).isFile()
      ? [root]
      : walk(root).concat(root.endsWith(".ts") ? [] : []);
    const unique = [...new Set(files)];
    for (const abs of unique) {
      const rel = normPosix(path.relative(REPO_ROOT, abs));
      if (allowed.has(rel)) continue;
      const text = fs.readFileSync(abs, "utf8");
      for (const { re, label } of banned) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          violations.push(
            `[LEGACY_TENANT_RESOLVER] ${rel}:${lineAt(text, m.index)} — ${label}`,
          );
        }
      }
    }
  }
  return violations;
}

/** Direct cross-origin API from browser (hybrid bypass). */
function checkDirectApiCalls(allow) {
  const webRoot = path.join(REPO_ROOT, "apps/web");
  const allowed = new Set((allow.directApiClientPaths ?? []).map(normPosix));
  const violations = [];
  const re = /\bapiClient\.(get|post|patch|put|delete)\s*\(/g;

  for (const abs of walk(webRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (rel.includes("/tests/") || rel.endsWith(".spec.ts") || rel.endsWith(".spec.tsx")) continue;
    if (allowed.has(rel)) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      violations.push(
        `[DIRECT_API_CALL] ${rel}:${lineAt(text, m.index)} — apiClient.${m[1]}() must use BFF (/api/*) or add to infrastructure-debt.allowlist.json with migration ticket`,
      );
    }
  }
  return violations;
}

/** Untyped failures in core infrastructure paths. */
function checkGenericErrorThrows(allow) {
  const scanRoots = [
    "apps/web/lib/api",
    "apps/web/lib/tenant",
    "apps/api/src/common/auth",
    "apps/api/src/common/middleware",
  ];
  const allowed = new Set((allow.genericErrorThrowPaths ?? []).map(normPosix));
  const violations = [];
  const re = /throw\s+new\s+Error\s*\(/g;

  for (const relRoot of scanRoots) {
    const absRoot = path.join(REPO_ROOT, relRoot);
    if (!fs.existsSync(absRoot)) continue;
    const files = fs.statSync(absRoot).isFile() ? [absRoot] : walk(absRoot);
    for (const abs of files) {
      const rel = normPosix(path.relative(REPO_ROOT, abs));
      if (rel.endsWith(".spec.ts")) continue;
      if (allowed.has(rel)) continue;
      const text = fs.readFileSync(abs, "utf8");
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        violations.push(
          `[GENERIC_ERROR_THROW] ${rel}:${lineAt(text, m.index)} — use AppError / GlobalErrorTaxonomy in core flows`,
        );
      }
    }
  }
  return violations;
}

function main() {
  const allow = readAllowlist();
  const violations = [
    ...checkLegacyTenantResolvers(allow),
    ...checkDirectApiCalls(allow),
    ...checkGenericErrorThrows(allow),
  ];

  if (violations.length === 0) {
    console.log("[infrastructure-debt] OK — 0 unallowlisted matches");
    process.exit(0);
  }

  console.error(`[infrastructure-debt] FAIL — ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

main();
