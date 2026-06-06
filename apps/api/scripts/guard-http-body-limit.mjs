#!/usr/bin/env node
/**
 * SCAL-DEBT-03 / DEC-052 — HTTP body limit must stay in readRequestBodyRaw.
 * @see docs/phase-5/appendices/http-request-body-limit.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_TS = path.join(ROOT, "src/http/json.ts");
const LIMIT_TS = path.join(ROOT, "src/http/request-body-limit.ts");

const jsonSource = fs.readFileSync(JSON_TS, "utf8");
const limitSource = fs.readFileSync(LIMIT_TS, "utf8");

const violations = [];

if (!jsonSource.includes("RequestBodyTooLargeError")) {
  violations.push("json.ts must throw RequestBodyTooLargeError");
}
if (!jsonSource.includes("resolveHttpMaxBodyBytes")) {
  violations.push("json.ts must call resolveHttpMaxBodyBytes");
}
if (!/contentLength\s*!==\s*undefined\s*&&\s*contentLength\s*>\s*maxBytes/.test(jsonSource)) {
  violations.push("json.ts must pre-check Content-Length against maxBytes");
}
if (!limitSource.includes("REQUEST_BODY_TOO_LARGE")) {
  violations.push("request-body-limit.ts must export REQUEST_BODY_TOO_LARGE");
}

const interceptorPath = path.join(ROOT, "src/middleware/error-interceptor.ts");
const interceptorSource = fs.readFileSync(interceptorPath, "utf8");
if (!interceptorSource.includes("isRequestBodyTooLargeError")) {
  violations.push("error-interceptor.ts must map RequestBodyTooLargeError to 413");
}

if (violations.length > 0) {
  console.error("guard-http-body-limit: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-body-limit: PASS");
