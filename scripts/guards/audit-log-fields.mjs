#!/usr/bin/env node
/**
 * Phase 7.5 — MAP §10.2 structured log field audit (REQ-P7-015 / REQ-P7-017).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGGER = path.join(REPO_ROOT, "apps/api/src/observability/logger.ts");
const REQUEST_LOGGING = path.join(REPO_ROOT, "apps/api/src/http/request-logging.ts");

const PHASE = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "7";

function fail(msg) {
  console.error(`audit-log-fields: FAIL — ${msg}`);
  process.exit(1);
}

if (PHASE !== "7") {
  fail(`unsupported --phase ${PHASE} (only 7)`);
}

const loggerSrc = fs.readFileSync(LOGGER, "utf8");
const requestLoggingSrc = fs.readFileSync(REQUEST_LOGGING, "utf8");

const requiredContextFields = ["requestId", "tenantId", "workspaceType", "tenantTier", "durationMs"];
for (const field of requiredContextFields) {
  if (!new RegExp(`\\b${field}\\b`).test(loggerSrc)) {
    fail(`RequestLogContext missing field: ${field}`);
  }
}

for (const field of ["requestId", "tenantId", "workspaceType", "tenantTier", "durationMs"]) {
  if (!loggerSrc.includes(`payload.${field}`) && !loggerSrc.includes(`payload["${field}"]`)) {
    if (field === "durationMs" && loggerSrc.includes("durationMs: ctx.durationMs")) {
      continue;
    }
    fail(`logHttpRequest must emit payload field: ${field}`);
  }
}

if (!requestLoggingSrc.includes("getActiveTenantId")) {
  fail("request-logging must read tenant ALS on finish");
}
if (!requestLoggingSrc.includes("resolveTenantConnectionTier")) {
  fail("request-logging must resolve tenantTier");
}

const urbanBranch = spawnSync(
  "rg",
  ["workspaceType === ['\"]urban['\"]", "apps/api/src/observability", "apps/api/src/http/request-logging.ts"],
  { cwd: REPO_ROOT, encoding: "utf8" }
);
if (urbanBranch.status === 0 && urbanBranch.stdout.trim().length > 0) {
  fail("urban-only log branches forbidden in generic logging layer");
}

console.log("audit-log-fields: PASS (phase 7)");
