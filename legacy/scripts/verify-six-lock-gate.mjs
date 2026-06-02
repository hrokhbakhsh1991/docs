#!/usr/bin/env node
/**
 * Six-lock gate (prompt.md): A–F static + E2E (login×3, create, patch, publish).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const staticOnly = process.argv.includes("--static-only");

const failures = [];
const passed = [];

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  passed.push(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}


// A — single resolver file (domain logic inlined in runtime-tenant-context)
if (!exists("apps/web/lib/tenant/runtime-tenant-context.ts")) {
  fail("A: missing runtime-tenant-context.ts");
} else {
  const rtc = read("apps/web/lib/tenant/runtime-tenant-context.ts");
  if (!rtc.includes("x-tenant-id") || !rtc.includes("resolveTenantSlugFromHost")) {
    fail("A: runtime-tenant-context missing x-tenant-id or slug extract");
  } else {
    ok("A: single resolver module with x-tenant-id + host pipeline");
  }
  if (exists("apps/web/lib/tenant/resolve-tenant-domain.ts")) {
    fail("A: resolve-tenant-domain.ts must be removed (merge into runtime-tenant-context)");
  }
  const splitCheck = spawnSync(
    "rg",
    ["host\\.split\\(", "apps/web/lib/tenant", "-g", "!**/*.spec.ts"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (splitCheck.status === 0) {
    const lines = splitCheck.stdout.trim().split("\n").filter(Boolean);
    const outsideRtc = lines.filter((l) => !l.startsWith("apps/web/lib/tenant/runtime-tenant-context.ts"));
    if (outsideRtc.length > 0) {
      fail(`A: host.split outside runtime-tenant-context: ${outsideRtc.join("; ")}`);
    } else {
      ok("A: host.split only in runtime-tenant-context.ts");
    }
  }
}

const denaliRuntime = spawnSync(
  "rg",
  ["-l", "denali\\.localhost", "apps/web", "apps/api/src", "-g", "!**/*.spec.ts", "-g", "!**/seed-denali*"],
  { cwd: REPO_ROOT, encoding: "utf8" },
);
if (denaliRuntime.status === 0 && denaliRuntime.stdout.trim()) {
  fail(`A: denali.localhost in runtime: ${denaliRuntime.stdout.trim().split("\n").join(", ")}`);
} else {
  ok("A: no denali.localhost in runtime paths");
}

const originSrc = read("apps/web/lib/tour-ops-api-origin.ts");
if (/process\.env\.NEXT_PUBLIC_API_URL/.test(originSrc)) {
  fail("D: tour-ops-api-origin still reads NEXT_PUBLIC_API_URL");
} else {
  ok("D: NEXT_PUBLIC_API_URL removed from tour-ops-api-origin runtime");
}

if (!read("apps/web/lib/api/get-api-base-url.ts").includes("getApiBaseUrl")) {
  fail("D: getApiBaseUrl missing");
} else {
  ok("D: getApiBaseUrl present");
}

for (const route of [
  "apps/web/app/api/auth/login-web-session/route.ts",
  "apps/web/app/api/auth/request-otp/route.ts",
  "apps/web/app/api/auth/phone-preflight/route.ts",
  "apps/web/app/api/auth/complete-registration/route.ts",
  "apps/web/app/api/auth/accept-invite/route.ts",
]) {
  const src = read(route);
  if (!src.includes("bffFetch")) {
    fail(`B: ${route} must use bffFetch`);
  }
  if (!src.includes("bffGuardErrorResponse")) {
    fail(`B: ${route} must use bffGuardErrorResponse for host guard errors`);
  }
}
ok("B: auth BFF routes use bffFetch + bffGuardErrorResponse");

if (!read("apps/web/lib/auth/build-session-cookie.ts").includes("httpOnly")) {
  fail("C: build-session-cookie missing httpOnly");
} else {
  ok("C: session cookie builder");
}

const apiUp =
  spawnSync("curl", ["-sf", "http://127.0.0.1:3001/health"], { encoding: "utf8" }).status === 0;
const webUp =
  spawnSync("curl", ["-sf", "-o", "/dev/null", "http://ws1-rbac.localhost:3000/"], {
    encoding: "utf8",
  }).status === 0;

if (!apiUp || !webUp) {
  if (staticOnly) {
    ok("F: E2E skipped (--static-only; API/Web not required)");
  } else {
    fail(`F: E2E skipped — API up=${apiUp} Web up=${webUp}`);
  }
} else {
  const gate = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", "verify-phase-10-gate.mjs")], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, PHASE10_COOLDOWN_MS: process.env.PHASE10_COOLDOWN_MS ?? "6000" },
  });
  if (gate.status !== 0) {
    fail("F: verify-phase-10-gate failed");
  } else {
    ok("F: login ws1/ws2/ws3 + create + patch + publish (OPEN)");
  }
}

if (failures.length) {
  process.exit(1);
}
