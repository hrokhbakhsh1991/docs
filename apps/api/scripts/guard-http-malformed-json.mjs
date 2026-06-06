#!/usr/bin/env node
/**
 * DEC-092 / Wave D — malformed JSON → 400 INVALID_JSON.
 * @see docs/phase-5/appendices/http-malformed-json.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const json = read("src/http/json.ts");
if (!json.includes("MalformedJsonBodyError")) {
  violations.push("json.ts must define MalformedJsonBodyError");
}
if (!json.includes("parseJsonBody")) {
  violations.push("json.ts must export parseJsonBody");
}
if (!json.includes("INVALID_JSON")) {
  violations.push("json.ts must export INVALID_JSON code");
}

const tourBody = read("src/tours/read-tour-request-body.ts");
if (!tourBody.includes("parseJsonBody")) {
  violations.push("read-tour-request-body.ts must use parseJsonBody");
}
if (tourBody.includes("JSON.parse")) {
  violations.push("read-tour-request-body.ts must not call JSON.parse directly");
}

const routes = read("src/tours/tours.routes.ts");
if (!routes.includes("readTourRequestBody")) {
  violations.push("tours.routes.ts must use readTourRequestBody");
}
if (routes.includes("JSON.parse")) {
  violations.push("tours.routes.ts must not call JSON.parse directly");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("isMalformedJsonBodyError")) {
  violations.push("error-interceptor.ts must map MalformedJsonBodyError to 400");
}

if (!fs.existsSync(path.join(ROOT, "test/4-integration/malformed-json-body.spec.ts"))) {
  violations.push("test/4-integration/malformed-json-body.spec.ts must exist");
}

if (violations.length > 0) {
  console.error("guard-http-malformed-json: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-malformed-json: PASS");
