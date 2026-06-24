#!/usr/bin/env node
/**
 * P8 Profile B — bare IP ingress + four-process health on VPS
 * @see docs/phase-21/runbooks/p8-profile-b-vps-smoke.md
 */
import { spawnSync } from "node:child_process";

const HOST = process.env.P8_PROFILE_B_HOST?.trim() || process.env.VPS_HOST?.trim() || "89.45.89.206";
const API_URL = (process.env.TOUR_OPS_API_URL?.trim() || `http://${HOST}:23001`).replace(/\/$/, "");
const WEB_URL = (process.env.P8_WEB_URL?.trim() || `http://${HOST}:23000`).replace(/\/$/, "");
const MKT_URL = (process.env.P8_MKT_URL?.trim() || `http://${HOST}:23002`).replace(/\/$/, "");
const PTL_URL = (process.env.P8_PTL_URL?.trim() || `http://${HOST}:23003`).replace(/\/$/, "");
const EXPECTED_TENANT =
  process.env.P8_SMOKE_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000014";

function curlJson(url, headers = []) {
  const args = ["-s", "-w", "\n__HTTP__%{http_code}", ...headers.flatMap((h) => ["-H", h]), url];
  const result = spawnSync("curl", args, { encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) {
    throw new Error(`curl failed ${url}: ${result.stderr || result.stdout}`);
  }
  const raw = result.stdout.trim();
  const split = raw.lastIndexOf("\n__HTTP__");
  const bodyText = split >= 0 ? raw.slice(0, split) : raw;
  const status = split >= 0 ? Number(raw.slice(split + "__HTTP__".length + 1)) : 0;
  let body;
  try {
    body = bodyText.length > 0 ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }
  return { status, body };
}

function curlHead(url, headers = []) {
  const args = ["-sI", ...headers.flatMap((h) => ["-H", h]), url];
  const result = spawnSync("curl", args, { encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) {
    throw new Error(`curl -I failed ${url}: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

let failed = false;
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`OK ${msg}`);
}

console.log(`== P8 Profile B smoke host=${HOST} api=${API_URL} ==`);

const health = curlJson(`${API_URL}/health`);
if (health.status !== 200) {
  fail(`api health → HTTP ${health.status}`);
} else {
  ok("api /health 200");
}

const ipCtx = curlJson(`${API_URL}/public/tenant-context`, [
  `host: ${HOST}`,
  `x-forwarded-host: ${HOST}`,
]);
const tenantId = ipCtx.body?.data?.tenantId;
const ingressSurface = ipCtx.body?.data?.ingressSurface;
if (ipCtx.status !== 200) {
  fail(`tenant-context bare IP → HTTP ${ipCtx.status} ${JSON.stringify(ipCtx.body)}`);
} else if (tenantId !== EXPECTED_TENANT) {
  fail(`tenant-context bare IP tenantId expected ${EXPECTED_TENANT}, got ${tenantId ?? "undefined"}`);
} else {
  ok(`tenant-context bare IP → ${tenantId} ingressSurface=${ingressSurface ?? "n/a"}`);
}
if (ingressSurface !== undefined && ingressSurface !== "ip_fallback") {
  fail(`ingressSurface expected ip_fallback, got ${ingressSurface}`);
}

for (const [label, base] of [
  ["marketing", MKT_URL],
  ["portal", PTL_URL],
  ["web", WEB_URL],
]) {
  const res = curlJson(`${base}/health`, [`host: ${HOST}`, `x-forwarded-host: ${HOST}`]);
  if (res.status !== 200) {
    fail(`${label} /health → HTTP ${res.status}`);
  } else {
    ok(`${label} /health 200`);
  }
}

const webHead = curlHead(`${WEB_URL}/auth/login`, [`host: ${HOST}`, `x-forwarded-host: ${HOST}`]);
const portalHead = curlHead(`${PTL_URL}/`, [`host: ${HOST}`, `x-forwarded-host: ${HOST}`]);
if (/Set-Cookie:.*\bsession=/i.test(webHead) && !/atour_op_session/.test(webHead)) {
  fail("web still uses generic session cookie name on Profile B");
} else {
  ok("web does not expose legacy generic session cookie on login surface");
}
if (/Set-Cookie:.*\bsession=/i.test(portalHead) && !/atour_mb_session/.test(portalHead)) {
  fail("portal still uses generic session cookie name");
} else {
  ok("portal does not expose legacy generic session cookie on /");
}

if (failed) {
  process.exit(1);
}
console.log("P8_PROFILE_B_SMOKE_OK");
