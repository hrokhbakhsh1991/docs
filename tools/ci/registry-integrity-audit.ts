#!/usr/bin/env npx tsx
/* eslint-disable no-console -- CI guardrail CLI reports violations to stderr/stdout */
/**
 * React Query tenant cache isolation guardrail.
 *
 * Scans apps/web for useQuery / useInfiniteQuery hooks whose queryKey omits an
 * explicit tenant scope token. Fails CI and pre-commit when a new hook would
 * allow cross-tenant cache collision after workspace switch.
 *
 * Run: pnpm run guardrails:query-key-integrity
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const WEB_ROOT = path.join(REPO_ROOT, "apps/web");

const TENANT_SCOPE_MARKERS: RegExp[] = [
  /\btenantId\b/,
  /\btenantScope\b/,
  /\bscopedTenantId\b/,
  /\btenantSlug\b/,
  /\bcontentWorkspace\b/,
  /\bworkspaceId\b/,
  /\w+Keys(?:\.\w+)?(?:\(|\b)/,
  /\{\s*tenantId\s*:/,
];

const EXEMPT_PATH_PREFIXES = [
  "apps/web/tests/",
  "apps/web/src/features/tours/wizard/denali/__tests__/",
];

const EXEMPT_FILE_SUFFIXES = [".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"];

function normPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function lineNumberAt(src: string, idx: number): number {
  return src.slice(0, idx).split("\n").length;
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "dist") continue;
      walk(p, acc);
    } else if (ent.isFile() && /\.(tsx?|jsx?)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function isExempt(rel: string): boolean {
  if (EXEMPT_FILE_SUFFIXES.some((suffix) => rel.endsWith(suffix))) return true;
  return EXEMPT_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

function skipWs(src: string, i: number): number {
  while (i < src.length && /\s/.test(src.charAt(i))) i += 1;
  return i;
}

function findMatchingParen(src: string, openIdx: number): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let esc = false;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let esc = false;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingBracket(src: string, openIdx: number): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let esc = false;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractBalancedFrom(src: string, startIdx: number, openChar: "{" | "(" | "["): string | null {
  if (src[startIdx] !== openChar) return null;
  const endIdx =
    openChar === "{"
      ? findMatchingBrace(src, startIdx)
      : openChar === "("
        ? findMatchingParen(src, startIdx)
        : findMatchingBracket(src, startIdx);
  if (endIdx < 0) return null;
  return src.slice(startIdx, endIdx + 1);
}

function extractQueryKeyProperty(optionsBody: string): string | null {
  const propRe = /\bqueryKey\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = propRe.exec(optionsBody)) !== null) {
    const valueStart = skipWs(optionsBody, match.index + match[0].length);
    if (valueStart >= optionsBody.length) return null;
    const c = optionsBody.charAt(valueStart);
    if (c === "{" || c === "(" || c === "[") {
      return extractBalancedFrom(optionsBody, valueStart, c as "{" | "(" | "[");
    }
    return extractExpressionFrom(optionsBody, valueStart);
  }
  return null;
}

function extractExpressionFrom(src: string, startIdx: number): string | null {
  let i = startIdx;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: "'" | '"' | "`" | null = null;
  let esc = false;

  while (i < src.length) {
    const c = src.charAt(i);
    if (quote) {
      if (esc) {
        esc = false;
        i += 1;
        continue;
      }
      if (c === "\\") {
        esc = true;
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      i += 1;
      continue;
    }
    if (c === "(") depthParen += 1;
    else if (c === ")") {
      if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) break;
      depthParen -= 1;
    } else if (c === "[") depthBracket += 1;
    else if (c === "]") depthBracket -= 1;
    else if (c === "{") depthBrace += 1;
    else if (c === "}") depthBrace -= 1;
    else if (
      depthParen === 0 &&
      depthBracket === 0 &&
      depthBrace === 0 &&
      c === ","
    ) {
      break;
    }
    i += 1;
  }
  return src.slice(startIdx, i).trim();
}

function extractHookOptions(src: string, hookIdx: number): string | null {
  const openParen = src.indexOf("(", hookIdx);
  if (openParen < 0) return null;
  const argsStart = skipWs(src, openParen + 1);
  if (argsStart >= src.length) return null;
  if (src[argsStart] === "{") {
    return extractBalancedFrom(src, argsStart, "{");
  }
  const closeParen = findMatchingParen(src, openParen);
  if (closeParen < 0) return null;
  return src.slice(argsStart, closeParen).trim();
}

function hasTenantScope(text: string): boolean {
  return TENANT_SCOPE_MARKERS.some((re) => re.test(text));
}

function resolveVariableDefinition(src: string, varName: string, beforeIdx: number): string | null {
  const slice = src.slice(Math.max(0, beforeIdx - 6000), beforeIdx);
  const useMemoRe = new RegExp(
    `(?:const|let)\\s+${varName}\\s*=\\s*useMemo\\(\\s*\\(\\)\\s*=>\\s*([\\s\\S]*?),\\s*\\[`,
    "g",
  );
  let useMemoMatch: RegExpExecArray | null;
  let lastUseMemo: string | null = null;
  while ((useMemoMatch = useMemoRe.exec(slice)) !== null) {
    lastUseMemo = useMemoMatch[1] ?? null;
  }
  if (lastUseMemo) return lastUseMemo;

  const constRe = new RegExp(`(?:const|let)\\s+${varName}\\s*=\\s*([^;\\n]+)`, "g");
  let constMatch: RegExpExecArray | null;
  let lastConst: string | null = null;
  while ((constMatch = constRe.exec(slice)) !== null) {
    lastConst = constMatch[1] ?? null;
  }
  return lastConst;
}

function hasExemptCommentAbove(src: string, idx: number): boolean {
  const lineStart = src.lastIndexOf("\n", idx - 1) + 1;
  const prevLineEnd = lineStart - 1;
  const prevLineStart = prevLineEnd >= 0 ? src.lastIndexOf("\n", prevLineEnd - 1) + 1 : 0;
  const currentPrefix = src.slice(lineStart, idx);
  const prevLine = src.slice(prevLineStart, Math.max(prevLineStart, lineStart - 1));
  return (
    /query-key-integrity:exempt/.test(currentPrefix) ||
    /query-key-integrity:exempt/.test(prevLine)
  );
}

function checkFile(absPath: string): string[] {
  const rel = normPosix(path.relative(REPO_ROOT, absPath));
  if (isExempt(rel)) return [];

  const src = fs.readFileSync(absPath, "utf8");
  if (!/\buse(?:Infinite)?Query\s*\(/.test(src)) return [];

  const violations: string[] = [];
  const hookRe = /\buse(?:Infinite)?Query\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = hookRe.exec(src)) !== null) {
    const hookIdx = match.index;
    if (hasExemptCommentAbove(src, hookIdx)) continue;

    const options = extractHookOptions(src, hookIdx);
    if (!options) continue;

    let queryKeyText = extractQueryKeyProperty(options);
    if (!queryKeyText) {
      violations.push(
        `[QUERY_KEY_TENANT_SCOPE] ${rel}:${lineNumberAt(src, hookIdx)} — useQuery/useInfiniteQuery must declare an explicit queryKey with tenantId (or approved public-site scope token).`,
      );
      continue;
    }

    const trimmed = queryKeyText.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
      const resolved = resolveVariableDefinition(src, trimmed, hookIdx);
      if (resolved) queryKeyText = resolved;
    }

    if (!hasTenantScope(queryKeyText)) {
      violations.push(
        `[QUERY_KEY_TENANT_SCOPE] ${rel}:${lineNumberAt(src, hookIdx)} — queryKey must include tenantId (or tenantSlug/contentWorkspace for public routes, or a *Keys factory). Found: ${truncate(queryKeyText, 96)}`,
      );
    }
  }

  return violations;
}

function main(): void {
  const files = walk(WEB_ROOT);
  const violations = files.flatMap(checkFile);

  if (violations.length > 0) {
    console.error(`\nregistry-integrity-audit: ${violations.length} violation(s)\n`);
    for (const v of violations) {
      console.error(v);
    }
    console.error("");
    process.exit(1);
  }

  console.log(`registry-integrity-audit: OK (${files.length} files scanned under apps/web)`);
}

main();
