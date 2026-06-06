#!/usr/bin/env node
/**
 * DEC-129 — HTTP egress size budget + tenant-config serialized cache.
 * @see docs/phase-5/appendices/http-response-size-budget.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_TS = path.join(ROOT, "src/http/json.ts");
const BUDGET_TS = path.join(ROOT, "src/http/http-response-size-budget.ts");
const TENANT_CONFIG = path.join(ROOT, "src/tenant/tenant-config.routes.ts");
const REGISTRY_CACHE = path.join(ROOT, "src/tenant/tenant-registry-cache.ts");
const INTERCEPTOR = path.join(ROOT, "src/middleware/error-interceptor.ts");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");

const jsonSource = fs.readFileSync(JSON_TS, "utf8");
const budgetSource = fs.readFileSync(BUDGET_TS, "utf8");
const tenantConfigSource = fs.readFileSync(TENANT_CONFIG, "utf8");
const registrySource = fs.readFileSync(REGISTRY_CACHE, "utf8");
const interceptorSource = fs.readFileSync(INTERCEPTOR, "utf8");
const gateSource = fs.readFileSync(GATE, "utf8");

const violations = [];

if (!budgetSource.includes("RESPONSE_TOO_LARGE")) {
  violations.push("http-response-size-budget.ts must export RESPONSE_TOO_LARGE");
}
if (!budgetSource.includes("resolveHttpMaxResponseBytes")) {
  violations.push("http-response-size-budget.ts must export resolveHttpMaxResponseBytes");
}
if (!jsonSource.includes("assertResponsePayloadWithinBudget")) {
  violations.push("json.ts sendJson must call assertResponsePayloadWithinBudget");
}
if (!/typeof body === "string"/.test(jsonSource)) {
  violations.push("json.ts sendJson must accept pre-serialized string fast path");
}
if (tenantConfigSource.includes("res.end(\n          JSON.stringify")) {
  violations.push("tenant-config.routes.ts must not inline JSON.stringify + res.end");
}
if (!tenantConfigSource.includes("getCachedTenantConfigPayload")) {
  violations.push("tenant-config.routes.ts must use tenant-config-response-cache");
}
if (!tenantConfigSource.includes("sendJson")) {
  violations.push("tenant-config.routes.ts must send via sendJson");
}
if (!registrySource.includes("invalidateTenantConfigResponseCache")) {
  violations.push("tenant-registry-cache.ts must evict tenant-config payload on invalidation");
}
if (!interceptorSource.includes("isResponseTooLargeError")) {
  violations.push("error-interceptor.ts must map ResponseTooLargeError");
}
if (!interceptorSource.includes("507")) {
  violations.push("error-interceptor.ts must return 507 for response too large");
}
if (!gateSource.includes("guard:http-response-size-budget")) {
  violations.push("phase-3-regression-gate.mjs must run guard:http-response-size-budget");
}
if (!gateSource.includes("src/http/json.spec.ts")) {
  violations.push("phase-3-regression-gate.mjs must run src/http/json.spec.ts");
}
if (!gateSource.includes("src/tenant/tenant-config-response-cache.spec.ts")) {
  violations.push("phase-3-regression-gate.mjs must run tenant-config-response-cache.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-http-response-size-budget: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-response-size-budget: PASS");
