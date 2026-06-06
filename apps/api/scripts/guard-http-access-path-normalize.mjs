#!/usr/bin/env node
/**
 * H-01 / DEC-128 — access logs must normalize HTTP path before logging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestLogging = fs.readFileSync(path.join(ROOT, "src/http/request-logging.ts"), "utf8");

const violations = [];

if (!requestLogging.includes("normalizeHttpLogPath")) {
  violations.push("request-logging.ts must import and use normalizeHttpLogPath");
}
if (
  /req\.url\s*\?\?\s*"/.test(requestLogging) &&
  !requestLogging.includes("normalizeHttpLogPath(req.url")
) {
  violations.push("request-logging.ts must wrap req.url with normalizeHttpLogPath");
}

if (violations.length > 0) {
  console.error("guard-http-access-path-normalize: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-access-path-normalize: PASS");
