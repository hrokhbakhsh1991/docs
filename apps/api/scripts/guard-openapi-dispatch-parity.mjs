#!/usr/bin/env node
/**
 * DEC-099 — dispatch inventory, app.ts wiring, and openapi.json must agree.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const { DISPATCH_ROUTES } = await import(
  pathToFileURL(path.join(ROOT, "src/openapi/dispatch-routes.ts")).href
);

const app = read("src/app.ts");
const openapiPath = path.join(ROOT, "openapi/openapi.json");
if (!fs.existsSync(openapiPath)) {
  violations.push("openapi/openapi.json missing — run pnpm run openapi:generate");
} else {
  const spec = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
  for (const route of DISPATCH_ROUTES) {
    const oasPath = route.path;
    const methods = spec.paths?.[oasPath];
    if (!methods?.[route.method.toLowerCase()]) {
      violations.push(`openapi.json missing ${route.method} ${oasPath}`);
    }
  }
  const uniqueInventoryPaths = new Set(DISPATCH_ROUTES.map((route) => route.path));
  const specPathCount = Object.keys(spec.paths ?? {}).length;
  if (specPathCount !== uniqueInventoryPaths.size) {
    violations.push(
      `openapi.json path count ${specPathCount} !== unique inventory paths ${uniqueInventoryPaths.size}`
    );
  }
}

function appWiresRoute(route) {
  if (route.path === "/health") {
    return app.includes('"/health"') && app.includes("handleHealth");
  }
  if (route.path === "/internal/metrics") {
    return app.includes('"/internal/metrics"') && app.includes("handleInternalMetrics");
  }
  if (route.path === "/internal/cache/invalidate") {
    return app.includes('"/internal/cache/invalidate"') && app.includes("handleCacheInvalidate");
  }
  if (route.path === "/api/v2/tenant-config") {
    return app.includes('"/api/v2/tenant-config"');
  }
  if (route.path === "/api/v2/map/enrich") {
    return app.includes('"/api/v2/map/enrich"');
  }
  if (route.path === "/internal/tenants/provision") {
    return app.includes('"/internal/tenants/provision"');
  }
  if (route.path === "/internal/test/db-pool-hold") {
    return app.includes('"/internal/test/db-pool-hold"');
  }
  if (route.path === "/internal/outbox/{outboxId}/replay") {
    return (
      app.includes("outboxReplayMatch") ||
      (app.includes("/internal/outbox/") && app.includes("handleReplayOutbox"))
    );
  }
  if (route.path === "/tours") {
    if (route.method === "GET") {
      return app.includes('"/tours"') && app.includes("handleListTours");
    }
    return app.includes('"/tours"') && app.includes("handleCreateTour");
  }
  if (route.path === "/tours/{tourId}") {
    return (
      app.includes("/tours/") && app.includes("handleGetTour") && app.includes("handlePatchTour")
    );
  }
  return false;
}

for (const route of DISPATCH_ROUTES) {
  if (!appWiresRoute(route)) {
    violations.push(`app.ts must wire ${route.method} ${route.path}`);
  }
}

if (!fs.existsSync(path.join(ROOT, "scripts/generate-openapi.mjs"))) {
  violations.push("scripts/generate-openapi.mjs must exist");
}

const pkg = read("package.json");
if (!pkg.includes("openapi:generate")) {
  violations.push("package.json must define openapi:generate");
}

if (violations.length > 0) {
  console.error("guard-openapi-dispatch-parity: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-openapi-dispatch-parity: PASS");
