#!/usr/bin/env node
/**
 * Tenant isolation architecture guardrails for CI.
 *
 * Checks:
 * 1) dataSource.query / this.dataSource.query in runtime API code (allowlisted paths only).
 * 2) @Body() DTO classes that declare tenant_id unless response-shaped / allowlisted.
 * 3) Active runtime SECURITY DEFINER usage must be documented in docs/security/security-definer.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(__dirname, "tenant-isolation-guardrails.allowlist.json");

function readAllowlist() {
  const raw = fs.readFileSync(ALLOWLIST_PATH, "utf8");
  return JSON.parse(raw);
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, acc);
    } else if (ent.isFile() && ent.name.endsWith(".ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function normPosix(p) {
  return p.split(path.sep).join("/");
}

function isIgnoredPath(rel, ignored) {
  return ignored.some((prefix) => rel.startsWith(prefix.replace(/^\.\//, "")));
}

/** --- Check 1: dataSource.query --- */
function checkDataSourceQuery(allow) {
  const apiRoot = path.join(REPO_ROOT, "apps/api/src");
  const files = walk(apiRoot).map((p) => ({
    abs: p,
    rel: normPosix(path.relative(REPO_ROOT, p))
  }));

  const ignored = allow.ignoredPathsForDataSourceQuery.map((x) =>
    normPosix(x.replace(/^\.\//, ""))
  );
  const allowedFiles = new Set(allow.dataSourceQueryPaths.map(normPosix));

  const violations = [];
  const re = /\b(?:this\.)?dataSource\.query\s*\(/g;

  for (const { abs, rel } of files) {
    if (isIgnoredPath(rel, ignored)) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    if (!allowedFiles.has(rel)) {
      violations.push(
        `${rel}: uses dataSource.query — use repositories / QueryBuilder under RLS tenant binding, or add path to scripts/tenant-isolation-guardrails.allowlist.json with justification.`
      );
    }
  }
  return violations;
}

/** --- Check 2: Body + tenant_id --- */
function extractExportedClassesWithTenantId(dtoText) {
  const blocks = [];
  const re =
    /export\s+class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(dtoText)) !== null) {
    const [, name, body] = m;
    if (/\btenant_id\b/.test(body)) {
      blocks.push({ name, body });
    }
  }
  return blocks;
}

function isResponseLikeClassName(name, suffixes) {
  return suffixes.some((s) => name.endsWith(s));
}

function checkBodyTenantDto(allow) {
  const modulesRoot = path.join(REPO_ROOT, "apps/api/src/modules");
  const dtoFiles = walk(modulesRoot).filter((p) => p.includes(`${path.sep}dto${path.sep}`));

  const allowBody = new Set(allow.bodyDtoAllowlist);
  const suffixes = allow.dtoResponseNameSuffixes;

  const riskyDtoNames = new Map();
  for (const abs of dtoFiles) {
    const text = fs.readFileSync(abs, "utf8");
    for (const { name } of extractExportedClassesWithTenantId(text)) {
      if (allowBody.has(name)) continue;
      if (isResponseLikeClassName(name, suffixes)) continue;
      riskyDtoNames.set(name, normPosix(path.relative(REPO_ROOT, abs)));
    }
  }

  const controllerFiles = walk(modulesRoot).filter((p) => p.endsWith("controller.ts"));
  const bodyTypeRe = /@Body(?:\([^)]*\))?\s+\w+\s*:\s*(\w+)/g;
  const violations = [];

  for (const abs of controllerFiles) {
    const text = fs.readFileSync(abs, "utf8");
    let m;
    while ((m = bodyTypeRe.exec(text)) !== null) {
      const typeName = m[1];
      if (riskyDtoNames.has(typeName)) {
        violations.push(
          `${normPosix(path.relative(REPO_ROOT, abs))}: @Body() uses ${typeName} — declares tenant_id (${riskyDtoNames.get(typeName)}). Tenant scope must come from Host/JWT/RLS, not client body (allowlist only with security review).`
        );
      }
    }
  }
  return violations;
}

/** --- Check 3: Active runtime SECURITY DEFINER registry --- */
function extractSqlTemplateLiterals(tsContent) {
  const out = [];
  const re = /(?:queryRunner|dataSource)\.query\s*\(\s*`([\s\S]*?)`\s*[,)]/g;
  let m;
  while ((m = re.exec(tsContent)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function extractFunctionsWithSecurityDefiner(sql) {
  if (!/\bSECURITY\s+DEFINER\b/i.test(sql)) return [];
  const names = new Set();
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z0-9_]+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    names.add(m[1].toLowerCase());
  }
  return [...names];
}

function parseSecurityDefinerDocFunctions(docMarkdown) {
  if (/Active runtime `SECURITY DEFINER` functions:\s*none/i.test(docMarkdown)) {
    return new Set();
  }
  const names = new Set();
  const rowRe = /`public\.([a-z0-9_]+)\(/gi;
  let m;
  while ((m = rowRe.exec(docMarkdown)) !== null) {
    names.add(m[1].toLowerCase());
  }
  return names;
}

function checkSecurityDefinerRegistry() {
  const docPath = path.join(REPO_ROOT, "docs/security/security-definer.md");
  if (!fs.existsSync(docPath)) {
    return [`Missing ${normPosix(path.relative(REPO_ROOT, docPath))}`];
  }
  const documented = parseSecurityDefinerDocFunctions(fs.readFileSync(docPath, "utf8"));
  const apiRoot = path.join(REPO_ROOT, "apps/api/src");
  const fromRuntime = new Set();
  for (const abs of walk(apiRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (
      rel.includes("/database/migrations/") ||
      rel.includes("/database/migrations_archive/")
    ) {
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    for (const sql of extractSqlTemplateLiterals(text)) {
      for (const fn of extractFunctionsWithSecurityDefiner(sql)) {
        fromRuntime.add(fn);
      }
    }
  }

  const violations = [];
  for (const fn of fromRuntime) {
    if (!documented.has(fn)) {
      violations.push(
        `Active runtime SECURITY DEFINER function "${fn}" is not documented in docs/security/security-definer.md.`
      );
    }
  }

  for (const fn of documented) {
    if (!fromRuntime.has(fn)) {
      violations.push(
        `docs/security/security-definer.md lists "${fn}" but no active runtime SECURITY DEFINER SQL was found — remove stale entry.`
      );
    }
  }

  return violations;
}

function main() {
  let allow;
  try {
    allow = readAllowlist();
  } catch (e) {
    console.error(e);
    process.exit(2);
  }

  const all = [
    ...checkDataSourceQuery(allow),
    ...checkBodyTenantDto(allow),
    ...checkSecurityDefinerRegistry()
  ];

  if (all.length > 0) {
    console.error("Tenant isolation guardrails FAILED:\n");
    for (const v of all) {
      console.error(`- ${v}`);
    }
    console.error(
      "\nSee docs/tenant-isolation-guardrails.md and scripts/tenant-isolation-guardrails.allowlist.json\n"
    );
    process.exit(1);
  }
  console.log("Tenant isolation guardrails: OK");
}

main();
