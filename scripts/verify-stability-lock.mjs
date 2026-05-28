#!/usr/bin/env node
/**
 * Post Phase 10–17 — Stability Lock Checklist (prompt.md).
 * Static guards + delegates to verify-phase-10-gate + run-tour-governance.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function readRepo(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(`missing: ${rel}`);
    return "";
  }
  return fs.readFileSync(abs, "utf8");
}

function fileExists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function grepRepo(pattern, opts = {}) {
  const { excludeTests = true, excludeExample = true } = opts;
  const args = ["rg", "-l", pattern, "apps/web", "apps/api", "packages", "--glob", "!**/dist/**"];
  if (excludeTests) {
    args.push("--glob", "!**/*.spec.ts", "--glob", "!**/*.test.ts", "--glob", "!**/tests/**");
  }
  if (excludeExample) {
    args.push("--glob", "!**/.env*", "--glob", "!**/*.example");
  }
  const r = spawnSync("rg", args.slice(1), { cwd: REPO_ROOT, encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim()) {
    return r.stdout.trim().split("\n");
  }
  return [];
}

function runNodeScript(name) {
  const scriptPath = path.join(REPO_ROOT, "scripts", name);
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    fail(`${name} exited ${r.status ?? 1}`);
  }
}


// §1 Tenant
const denaliHits = grepRepo("denali\\.localhost");
if (denaliHits.length > 0) {
  warn(`denali.localhost references (non-test): ${denaliHits.join(", ")}`);
}
if (!fileExists("apps/web/lib/tenant/runtime-tenant-context.ts")) {
  fail("missing runtime-tenant-context.ts");
}
const rtc = readRepo("apps/web/lib/tenant/runtime-tenant-context.ts");
if (!rtc.includes("x-tenant-id") || !rtc.includes("resolveTenantSlugFromHost")) {
  fail("runtime-tenant-context missing x-tenant-id or resolveTenantSlugFromHost");
}

// §8 Cookie
for (const f of [
  "apps/web/lib/auth/build-session-cookie.ts",
  "apps/web/app/api/auth/login-web-session/route.ts",
  "apps/web/app/api/auth/logout/route.ts",
]) {
  if (!fileExists(f)) fail(`missing ${f}`);
}
const loginRoute = readRepo("apps/web/app/api/auth/login-web-session/route.ts");
if (!loginRoute.includes("buildSessionCookieOptions")) {
  fail("login-web-session must use buildSessionCookieOptions");
}

// §6 Contract
for (const f of [
  "packages/shared-contracts/src/tours/tour-create-contract.ts",
  "packages/shared-contracts/src/tours/tour-patch-contract.ts",
]) {
  if (!fileExists(f)) fail(`missing ${f}`);
}

// §9 Observability
if (!fileExists("apps/api/src/common/observability/request-trace.middleware.ts")) {
  fail("missing request-trace.middleware.ts");
}
if (!fileExists("apps/api/src/common/logging/rbac-logger.ts")) {
  fail("missing rbac-logger.ts");
}

// §12 Deploy
if (!fileExists("packages/config/env-validation.ts")) {
  fail("missing packages/config/env-validation.ts");
}
const apiValidation = readRepo("apps/api/src/config/config.validation.ts");
if (!apiValidation.includes("validateDeployEnv")) {
  fail("API config.validation must call validateDeployEnv");
}

// §5 Lifecycle matrix
if (!fileExists("packages/shared/rbac/tour-lifecycle-governance.ts")) {
  fail("missing tour-lifecycle-governance.ts");
}

// §7 BFF
if (!fileExists("apps/web/lib/api/bff-fetch.ts")) {
  fail("missing bff-fetch.ts");
}

const OTP = process.env.PHASE10_OTP ?? "1234";
const MINIMAL_TOUR_BODY = {
  title: "StabilityLock TenCharMinimum",
  total_capacity: 12,
  lifecycle_status: "Draft",
  formProfile: "urban_event",
  transportModes: [],
};

function uniquePhoneForEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `+1555${String(hash % 10_000_000).padStart(7, "0")}`;
}

function tenantWebOrigin(slug) {
  return `http://${slug}.localhost:3000`;
}

function tenantApiOrigin(slug) {
  return `http://${slug}.localhost:3001`;
}

async function apiOwnerToken(slug, email) {
  const phone = uniquePhoneForEmail(email);
  const res = await fetch(`${tenantApiOrigin(slug)}/api/v2/auth/web/session/otp`, {
    method: "POST",
    headers: {
      Host: `${slug}.localhost:3001`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, otp: OTP }),
  });
  if (!res.ok) {
    throw new Error(`${slug} api login → ${res.status}`);
  }
  const body = await res.json();
  const token = typeof body.session_token === "string" ? body.session_token.trim() : "";
  if (!token) {
    throw new Error(`${slug} api login: missing session_token`);
  }
  return token;
}

async function checkSessionPersistence() {
  const slug = "ws1-rbac";
  const origin = tenantWebOrigin(slug);
  const phone = uniquePhoneForEmail("ws1-owner@test.com");
  const loginRes = await fetch(`${origin}/api/auth/login-web-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp: OTP }),
  });
  if (!loginRes.ok) {
    throw new Error(`BFF login → ${loginRes.status}`);
  }
  const setCookies = loginRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie.includes("session=")) {
    throw new Error("BFF login: missing session cookie");
  }
  for (let i = 0; i < 2; i += 1) {
    const sessionRes = await fetch(`${origin}/api/auth/session`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    if (!sessionRes.ok) {
      throw new Error(`GET /api/auth/session #${i + 1} → ${sessionRes.status}`);
    }
    const payload = await sessionRes.json();
    if (payload.authenticated !== true) {
      throw new Error(`session not persisted on read #${i + 1}`);
    }
  }
  const logoutRes = await fetch(`${origin}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  if (!logoutRes.ok) {
    throw new Error(`logout → ${logoutRes.status}`);
  }
  const clearedJar = logoutRes.headers.getSetCookie?.() ?? [];
  const afterCookie =
    clearedJar.length > 0
      ? clearedJar.map((c) => c.split(";")[0]).join("; ")
      : "";
  const afterRes = await fetch(`${origin}/api/auth/session`, {
    headers: afterCookie ? { Cookie: afterCookie } : { Cookie: "session=" },
    cache: "no-store",
  });
  const afterPayload = await afterRes.json();
  if (afterPayload.authenticated === true) {
    throw new Error("logout did not clear session");
  }
}

async function checkIllegalLifecycleSkipOpen() {
  const slug = "ws1-rbac";
  const token = await apiOwnerToken(slug, "ws1-owner@test.com");
  const host = `${slug}.localhost:3001`;
  const api = tenantApiOrigin(slug);
  const { randomUUID } = await import("node:crypto");

  const createRes = await fetch(`${api}/api/v2/tours`, {
    method: "POST",
    headers: {
      Host: host,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(MINIMAL_TOUR_BODY),
  });
  if (createRes.status !== 201) {
    throw new Error(`CREATE draft → ${createRes.status}`);
  }
  const { id: tourId } = await createRes.json();

  const skipOpen = await fetch(`${api}/api/v2/tours/${tourId}`, {
    method: "PATCH",
    headers: {
      Host: host,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ lifecycle_status: "CLOSED" }),
  });
  if (skipOpen.status !== 400) {
    const text = await skipOpen.text();
    throw new Error(`DRAFT→CLOSED expected 400, got ${skipOpen.status}: ${text.slice(0, 200)}`);
  }
  const errBody = await skipOpen.json();
  const code = errBody?.error?.code;
  const allowed = new Set(["INVALID_LIFECYCLE_TRANSITION", "STATE_TRANSITION_INVALID"]);
  if (!allowed.has(code)) {
    throw new Error(`DRAFT→CLOSED expected lifecycle error code, got ${code}`);
  }
}

function scanStrayHostSplit() {
  const allowed = new Set([
    path.join(REPO_ROOT, "apps/web/lib/tenant/runtime-tenant-context.ts"),
    path.join(REPO_ROOT, "apps/api/src/modules/tenant/tenant-host-resolver.service.ts"),
    path.join(REPO_ROOT, "packages/tenant-host/src/normalize-inbound-hostname.ts"),
  ]);
  const r = spawnSync(
    "rg",
    ["host\\.split\\(", "apps/web/lib/tenant", "apps/api/src/common/tenant", "-g", "!**/*.spec.ts"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (r.status !== 0) {
    return;
  }
  for (const line of r.stdout.trim().split("\n")) {
    if (!line) continue;
    const filePath = line.split(":")[0];
    const abs = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
    if (!allowed.has(abs) && line.includes('split(".")')) {
      fail(`stray host.split("."): ${line}`);
    }
  }
}

scanStrayHostSplit();
if (!fileExists("apps/web/lib/tenant/resolve-tenant-context-helpers.ts")) {
} else {
  warn("resolve-tenant-context-helpers.ts still present");
}

runNodeScript("run-tour-governance.mjs");

async function runRuntimeChecks() {
  const apiUp =
    spawnSync("curl", ["-sf", "http://127.0.0.1:3001/health"], { encoding: "utf8" }).status === 0;
  const webUp =
    spawnSync("curl", ["-sf", "-o", "/dev/null", "http://ws1-rbac.localhost:3000/api/auth/session"], {
      encoding: "utf8",
    }).status === 0;

  if (!apiUp) {
    warn("API :3001 not up — skipping runtime lifecycle + phase-10 gate");
    return;
  }

  try {
    await checkIllegalLifecycleSkipOpen();
  } catch (e) {
    fail(`§5 lifecycle: ${e.message}`);
  }

  if (webUp) {
    try {
      await checkSessionPersistence();
    } catch (e) {
      fail(`§2 session: ${e.message}`);
    }
  } else {
    warn("Web :3000 not up — skipping BFF session persistence check");
  }

  runNodeScript("verify-phase-10-gate.mjs");
}

runRuntimeChecks().then(() => {
  if (warnings.length) {
  }
  if (failures.length) {
    process.exit(1);
  }
});

