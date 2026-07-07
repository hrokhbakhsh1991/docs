#!/usr/bin/env node
/**
 * PCMS + WRS — custom apex smoke (API tenant-context + optional cookie domain curl).
 * @see docs/phase-19/p6/runbooks/denali-club-cutover.md
 */
import { spawnSync } from "node:child_process";

const API_URL = process.env.TOUR_OPS_API_URL?.trim() || "http://127.0.0.1:3001";
const EXPECTED_TENANT =
  process.env.P6_WRS_EXPECT_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000003";

const HOSTS = [
  process.env.P6_WRS_APEX_HOST?.trim() || "denali.club",
  process.env.P6_WRS_PORTAL_HOST?.trim() || "portal.denali.club",
  process.env.P6_WRS_ADMIN_HOST?.trim() || "admin.denali.club",
];

function assertApiReachable() {
  const probe = spawnSync(
    "curl",
    ["-s", "-o", "/dev/null", "-w", "%{http_code}", `${API_URL}/health`],
    { encoding: "utf8" }
  );
  const status = probe.stdout?.trim();
  if (probe.status !== 0 || !status || status === "000") {
    console.error(
      `FAIL API unreachable at ${API_URL} — start @apps/api with WRS_SMOKE_CUSTOM_APEX=1 or seed tenant_domains`
    );
    process.exit(1);
  }
}

function fetchContext(forwardedHost) {
  const result = spawnSync(
    "curl",
    [
      "-s",
      "-H",
      `host: ${forwardedHost}`,
      "-H",
      `x-forwarded-host: ${forwardedHost}`,
      `${API_URL}/public/tenant-context`,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`curl failed for ${forwardedHost}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function assertTenant(host, body) {
  const tenantId = body?.data?.tenantId;
  if (tenantId !== EXPECTED_TENANT) {
    console.error(`FAIL ${host}: expected ${EXPECTED_TENANT}, got ${tenantId ?? "undefined"}`);
    return false;
  }
  console.log(`OK ${host} → ${tenantId}`);
  return true;
}

assertApiReachable();

let failed = false;

for (const host of HOSTS) {
  try {
    const body = fetchContext(host);
    if (!assertTenant(host, body)) {
      failed = true;
    }
  } catch (error) {
    console.error(`FAIL ${host}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("PCMS_CUSTOM_APEX_SMOKE_OK");
