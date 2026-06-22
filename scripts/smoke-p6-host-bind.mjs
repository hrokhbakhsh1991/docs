#!/usr/bin/env node
/**
 * P6-0-N-007 — curl /public/tenant-context on three canonical dev hosts
 * @see docs/phase-19/p6/runbooks/host-subdomain-map.md
 */
import { spawnSync } from "node:child_process";

const API_URL = process.env.TOUR_OPS_API_URL?.trim() || "http://127.0.0.1:4000";
const EXPECTED_TENANT =
  process.env.P6_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

const HOSTS = [
  "operator.localhost",
  "operator.portal.localhost",
  "operator.admin.localhost",
];

function fetchTenantId(forwardedHost) {
  const result = spawnSync(
    "curl",
    [
      "-s",
      "-H",
      `x-forwarded-host: ${forwardedHost}`,
      `${API_URL}/public/tenant-context`,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`curl failed for ${forwardedHost}: ${result.stderr || result.stdout}`);
  }
  const body = JSON.parse(result.stdout);
  return body?.data?.tenantId;
}

let failed = false;
for (const host of HOSTS) {
  const tenantId = fetchTenantId(host);
  if (tenantId !== EXPECTED_TENANT) {
    console.error(`FAIL ${host}: expected ${EXPECTED_TENANT}, got ${tenantId ?? "undefined"}`);
    failed = true;
  } else {
    console.log(`OK ${host} → ${tenantId}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("P6_HOST_BIND_SMOKE_OK");
