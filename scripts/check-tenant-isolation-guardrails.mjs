#!/usr/bin/env node
/**
 * Tenant isolation architecture guardrails for CI.
 *
 * Checks:
 * 1) dataSource.query / this.dataSource.query in runtime API code (allowlisted paths only).
 * 1b) Allowlisted dataSource.query: first-arg SQL must be catalog/health-shaped or contain tenant binding.
 * 2) @Body() DTO classes that declare tenant_id or tenantId (client-controlled tenant) unless response-shaped / allowlisted.
 * 3) Active runtime SECURITY DEFINER usage must be documented in docs/security/security-definer.md.
 * 4) Explicit HTTP body tenant reads (req.request.body.tenantId / tenant_id, including bracket access).
 * 5) EntityManager raw SQL: manager.query( — first static SQL arg must include tenant_id/workspace_id or GUC set_config.
 * 6) createQueryBuilder: chain window must reference tenant/workspace scoping, or `// tenant-isolation:qb-exempt` above.
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

function lineNumberAt(src, idx) {
  return src.slice(0, idx).split("\n").length;
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
        `[DATASOURCE_QUERY] ${rel}: uses dataSource.query — use repositories / QueryBuilder under RLS tenant binding, or add path to scripts/tenant-isolation-guardrails.allowlist.json with justification.`
      );
    }
  }
  return violations;
}

/** --- Check 1b: allowlisted dataSource.query SQL body --- */
function skipWs(s, i) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}

function extractFirstStringOrTemplateArg(src, openParenIdx) {
  let i = skipWs(src, openParenIdx + 1);
  if (i >= src.length) return null;
  const c = src[i];
  if (c === "`") {
    let j = i + 1;
    while (j < src.length && src[j] !== "`") j += 1;
    if (j >= src.length) return null;
    return src.slice(i + 1, j);
  }
  if (c === '"' || c === "'") {
    const quote = c;
    let j = i + 1;
    let esc = false;
    while (j < src.length) {
      if (esc) {
        esc = false;
        j += 1;
        continue;
      }
      if (src[j] === "\\") {
        esc = true;
        j += 1;
        continue;
      }
      if (src[j] === quote) {
        return src.slice(i + 1, j);
      }
      j += 1;
    }
    return null;
  }
  return null;
}

function sqlLooksSafeCatalogOrHealth(sql) {
  if (!sql || typeof sql !== "string") return false;
  const s = sql.replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  if (/^\s*select\s+1\b/i.test(s)) return true;
  if (/\binformation_schema\b/i.test(s)) return true;
  if (/\bpg_catalog\b/i.test(s)) return true;
  if (/^\s*(begin|commit|rollback)\b/i.test(s)) return true;
  return false;
}

function sqlShowsTenantBinding(sql) {
  if (!sql || typeof sql !== "string") return false;
  return (
    /\btenant_id\b/i.test(sql) ||
    /\bworkspace_id\b/i.test(sql) ||
    /set_config\s*\(\s*['"]app\.tenant_id['"]/i.test(sql) ||
    /current_setting\s*\(\s*['"]app\.tenant_id['"]/i.test(sql)
  );
}

function checkAllowlistedDataSourceQuerySql(allow) {
  const violations = [];
  const allowedRel = (allow.dataSourceQueryPaths || []).map(normPosix);
  const re = /\b(?:this\.)?dataSource\.query\s*\(/g;

  for (const rel of allowedRel) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      const openParen = m.index + m[0].length - 1;
      const sql = extractFirstStringOrTemplateArg(text, openParen);
      if (sql === null) {
        violations.push(
          `[RAW_SQL_TENANT] ${rel}:${lineNumberAt(text, m.index)}: dataSource.query uses non-literal SQL — add a static template/string so tenant binding can be verified, or refactor.`
        );
        continue;
      }
      if (sqlLooksSafeCatalogOrHealth(sql) || sqlShowsTenantBinding(sql)) {
        continue;
      }
      violations.push(
        `[RAW_SQL_TENANT] ${rel}:${lineNumberAt(text, m.index)}: allowlisted dataSource.query SQL lacks tenant_id/workspace_id/app.tenant_id binding and is not a catalog/health probe.`
      );
    }
  }
  return violations;
}

/** --- Check 2: Body + tenant scope fields --- */
function stripTsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

function iterExportClassBodies(ts) {
  const out = [];
  const re = /^export\s+class\s+(\w+)(?:\s+extends\s+[\w.<>,\s]+)?\s*\{/gm;
  let m;
  while ((m = re.exec(ts)) !== null) {
    const name = m[1];
    const openBraceIdx = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = openBraceIdx; i < ts.length; i++) {
      const ch = ts[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          out.push({ name, body: ts.slice(openBraceIdx + 1, i) });
          break;
        }
      }
    }
  }
  return out;
}

function classBodyDeclaresClientTenantScope(body) {
  const c = stripTsComments(body);
  if (/\btenant_id\b/.test(c)) return true;
  if (/\btenantId\s*[!?]?\s*:/.test(c)) return true;
  return false;
}

function extractExportedClassesWithClientTenantScope(dtoText) {
  return iterExportClassBodies(dtoText).filter((x) => classBodyDeclaresClientTenantScope(x.body));
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
    for (const { name } of extractExportedClassesWithClientTenantScope(text)) {
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
          `[BODY_DTO_TENANT] ${normPosix(path.relative(REPO_ROOT, abs))}: @Body() uses ${typeName} — declares tenant_id and/or tenantId (${riskyDtoNames.get(typeName)}). Tenant scope must come from Host/JWT/RLS, not client body (allowlist only with security review).`
        );
      }
    }
  }
  return violations;
}

/** --- Check: req / request body tenant --- */
function checkHttpBodyTenantAccess(allow) {
  const roots = [
    path.join(REPO_ROOT, "apps/api/src/modules"),
    path.join(REPO_ROOT, "apps/api/src/common"),
    path.join(REPO_ROOT, "apps/api/src/jobs")
  ];
  const ignored = (allow.ignoredPathsForHttpBodyTenant || [
    "apps/api/src/database/migrations/",
    "apps/api/src/scripts/",
    "apps/api/test/",
    "apps/api/dist/"
  ]).map((x) => normPosix(x.replace(/^\.\//, "")));

  const patterns = [
    { id: "HTTP_BODY.tenantId", re: /\b(?:req|request)\s*\.\s*body\s*\.\s*tenantId\b/g },
    { id: "HTTP_BODY.tenant_id", re: /\b(?:req|request)\s*\.\s*body\s*\.\s*tenant_id\b/g },
    {
      id: "HTTP_BODY['tenantId']",
      re: /\b(?:req|request)\s*\.\s*body\s*\[\s*["']tenantId["']\s*\]/g
    },
    {
      id: "HTTP_BODY['tenant_id']",
      re: /\b(?:req|request)\s*\.\s*body\s*\[\s*["']tenant_id["']\s*\]/g
    }
  ];

  const violations = [];
  for (const root of roots) {
    for (const abs of walk(root)) {
      const rel = normPosix(path.relative(REPO_ROOT, abs));
      if (isIgnoredPath(rel, ignored)) continue;
      const text = fs.readFileSync(abs, "utf8");
      for (const { id, re } of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          violations.push(
            `[${id}] ${rel}:${lineNumberAt(text, m.index)}: do not read tenant scope from the HTTP body — use Host/JWT + RLS.`
          );
        }
      }
    }
  }
  return violations;
}

/** --- Check: manager.query raw SQL --- */
function checkManagerQueryTenant(allow) {
  const apiRoot = path.join(REPO_ROOT, "apps/api/src");
  const ignored = (allow.ignoredPathsForManagerQuery || [
    "apps/api/src/database/migrations/",
    "apps/api/src/scripts/",
    "apps/api/test/",
    "apps/api/dist/",
    "apps/api/src/database/tenant-db-context.service.ts"
  ]).map((x) => normPosix(x.replace(/^\.\//, "")));

  const violations = [];
  const re = /\bmanager\.query\s*\(/g;

  for (const abs of walk(apiRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (isIgnoredPath(rel, ignored)) continue;
    const text = fs.readFileSync(abs, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      const openParen = m.index + m[0].length - 1;
      const sql = extractFirstStringOrTemplateArg(text, openParen);
      if (sql === null) {
        violations.push(
          `[MANAGER_RAW_SQL] ${rel}:${lineNumberAt(text, m.index)}: manager.query uses non-literal SQL — cannot verify tenant binding.`
        );
        continue;
      }
      if (sqlLooksSafeCatalogOrHealth(sql) || sqlShowsTenantBinding(sql)) {
        continue;
      }
      violations.push(
        `[MANAGER_RAW_SQL] ${rel}:${lineNumberAt(text, m.index)}: manager.query SQL lacks tenant_id/workspace_id/app.tenant_id binding (defense-in-depth for raw SQL).`
      );
    }
  }
  return violations;
}

const QB_TENANT_MARKERS =
  /\btenant_id\b|\btenantId\b|:tenantId|\bworkspace_id\b|\bworkspaceId\b|:workspaceId|\.tenant_id\b|\.tenantId\b/;

function queryBuilderMarkedExempt(src, qbIdx) {
  const head = src.slice(0, qbIdx);
  const lines = head.split("\n").slice(-8);
  return lines.some((ln) => ln.includes("tenant-isolation:qb-exempt"));
}

function sliceTypeormQbChain(src, qbIdx) {
  const tail = src.slice(qbIdx);
  const patterns = [
    /\.getMany\s*\(/,
    /\.getOne\s*\(/,
    /\.execute\s*\(/,
    /\.getCount\s*\(/,
    /\.getRawMany\s*[\(<]/,
    /\.getRawOne\s*[\(<]/
  ];
  let end = tail.length;
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(tail);
    if (m) {
      end = Math.min(end, m.index + m[0].length);
    }
  }
  return tail.slice(0, end);
}

function checkCreateQueryBuilderTenant(allow) {
  const apiRoot = path.join(REPO_ROOT, "apps/api/src");
  const ignored = (allow.ignoredPathsForQueryBuilderTenant || []).map((x) =>
    normPosix(x.replace(/^\.\//, ""))
  );
  const violations = [];
  const re = /\.createQueryBuilder\s*\(/g;

  for (const abs of walk(apiRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (isIgnoredPath(rel, ignored)) continue;
    const text = fs.readFileSync(abs, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (queryBuilderMarkedExempt(text, m.index)) continue;
      const chain = sliceTypeormQbChain(text, m.index);
      if (!QB_TENANT_MARKERS.test(chain)) {
        violations.push(
          `[QUERY_BUILDER_TENANT] ${rel}:${lineNumberAt(text, m.index)}: TypeORM QueryBuilder chain has no tenant_id / tenantId / workspace_id predicate — add an explicit tenant/workspace filter, or place // tenant-isolation:qb-exempt on the preceding line with justification.`
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
    return [`[SECURITY_DEFINER_DOC] Missing ${normPosix(path.relative(REPO_ROOT, docPath))}`];
  }
  const documented = parseSecurityDefinerDocFunctions(fs.readFileSync(docPath, "utf8"));
  const apiRoot = path.join(REPO_ROOT, "apps/api/src");
  const fromRuntime = new Set();
  for (const abs of walk(apiRoot)) {
    const rel = normPosix(path.relative(REPO_ROOT, abs));
    if (rel.includes("/database/migrations/")) {
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
        `[SECURITY_DEFINER] Active runtime SECURITY DEFINER function "${fn}" is not documented in docs/security/security-definer.md.`
      );
    }
  }

  for (const fn of documented) {
    if (!fromRuntime.has(fn)) {
      violations.push(
        `[SECURITY_DEFINER] docs/security/security-definer.md lists "${fn}" but no active runtime SECURITY DEFINER SQL was found — remove stale entry.`
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
    ...checkAllowlistedDataSourceQuerySql(allow),
    ...checkBodyTenantDto(allow),
    ...checkHttpBodyTenantAccess(allow),
    ...checkManagerQueryTenant(allow),
    ...checkCreateQueryBuilderTenant(allow),
    ...checkSecurityDefinerRegistry()
  ];

  if (all.length > 0) {
    console.error("Tenant isolation guardrails FAILED:\n");
    for (const v of all) {
      console.error(`- ${v}`);
    }
    console.error(
      "\nSee docs/tenant-isolation-guardrails.md, docs/security/security-ci-guardrails.md, and scripts/tenant-isolation-guardrails.allowlist.json\n"
    );
    process.exit(1);
  }
  console.log("Tenant isolation guardrails: OK");
}

main();
