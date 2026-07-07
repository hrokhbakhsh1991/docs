#!/usr/bin/env node
/**
 * AP14 — forbid leaking err.message into HTTP response bodies (all apps/api/src).
 * @see docs/dev/error-handling-standard.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, relFromRepo, walkApiSrcFiles } from "./lib/walk-api-src.mjs";

/** Central mapper and non-HTTP worker entrypoints — exempt from line scans. */
const FILE_ALLOWLIST = new Set([
  "apps/api/src/middleware/error-interceptor.ts",
  "apps/api/src/canonical/validation-worker-entry.ts",
]);

/** @type {ReadonlySet<string>} */
const BANNED_PATTERNS = new Set([
  "(err as Error).message",
  "(error as Error).message",
]);

/** @type {RegExp[]} */
const RESPONSE_LEAK_RES = [
  /res\.end\s*\(\s*JSON\.stringify\s*\(\s*\{[^}]*\berror\s*:\s*(err|error)\.message/,
  /res\.end\s*\(\s*JSON\.stringify\s*\(\s*\{[^}]*\bmessage\s*:\s*(err|error)\.message/,
  /sendHttpError\s*\([^)]*\berror\s*:\s*(err|error)\.message/,
  /sendHttpError\s*\([^)]*\bmessage\s*:\s*(err|error)\.message/,
];

/** @type {string[]} */
const violations = [];

for (const file of walkApiSrcFiles()) {
  const rel = relFromRepo(file);
  if (FILE_ALLOWLIST.has(rel)) {
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }
    for (const banned of BANNED_PATTERNS) {
      if (line.includes(banned)) {
        violations.push(`${rel}:${i + 1}: banned ${banned}`);
      }
    }
    for (const re of RESPONSE_LEAK_RES) {
      if (re.test(line)) {
        violations.push(`${rel}:${i + 1}: HTTP response embeds err.message — use handleHttpError`);
      }
    }
  }
}

const interceptorPath = path.join(
  REPO_ROOT,
  "apps/api/src/middleware/error-interceptor.ts"
);
if (!fs.readFileSync(interceptorPath, "utf8").includes("export function mapPrismaErrorToAppError")) {
  violations.push("apps/api/src/middleware/error-interceptor.ts: missing mapPrismaErrorToAppError export");
}

if (violations.length > 0) {
  console.error("guard-catch-error-leak: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-catch-error-leak: PASS (apps/api/src does not leak err.message into HTTP bodies)"
);
