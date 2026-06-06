#!/usr/bin/env node
/**
 * DEC-093 / Wave D — TenantHttpProxy production DI + map enrich route.
 * @see docs/phase-5/appendices/proxy-production-wire.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const main = read("src/main.ts");
if (!main.includes("TenantHttpProxy")) {
  violations.push("main.ts must construct TenantHttpProxy");
}
if (!main.includes("MAP_UPSTREAM_BASE_URL")) {
  violations.push("main.ts must read MAP_UPSTREAM_BASE_URL");
}
if (!main.includes("tenantHttpProxy")) {
  violations.push("main.ts must pass tenantHttpProxy to createRequestListener");
}

const app = read("src/app.ts");
if (!app.includes("/api/v2/map/enrich")) {
  violations.push("app.ts must route GET /api/v2/map/enrich");
}
if (!app.includes("handleMapEnrich")) {
  violations.push("app.ts must dispatch handleMapEnrich");
}

const route = read("src/routes/api-v2/map-enrich.routes.ts");
if (!route.includes("MAP_UPSTREAM_NOT_CONFIGURED")) {
  violations.push("map-enrich.routes.ts must return MAP_UPSTREAM_NOT_CONFIGURED when proxy unset");
}
if (!route.includes("tenantHttpProxy")) {
  violations.push("map-enrich.routes.ts must use tenantHttpProxy.fetch");
}

if (!fs.existsSync(path.join(ROOT, "test/4-integration/proxy-production-wire.spec.ts"))) {
  violations.push("test/4-integration/proxy-production-wire.spec.ts must exist");
}

if (violations.length > 0) {
  console.error("guard-proxy-production-wire: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-proxy-production-wire: PASS");
