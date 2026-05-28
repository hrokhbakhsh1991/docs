#!/usr/bin/env node
/**
 * Phase 7 tenant security gate — static checks + optional live smoke.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

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


if (!exists("packages/tenant-host/package.json")) {
  fail("missing @repo/tenant-host package");
} else {
  ok("@repo/tenant-host package present");
}

const rtc = read("apps/web/lib/tenant/runtime-tenant-context.ts");
if (!rtc.includes("resolveBffTenantContext")) {
  fail("web: resolveBffTenantContext missing");
} else {
  ok("web: resolveBffTenantContext");
}

const bffFn = rtc.match(
  /export function resolveBffTenantContext\(req: Request[^)]*\): TenantContext \{[\s\S]*?\n\}/,
);
if (!bffFn) {
  fail("web: resolveBffTenantContext body not found");
} else if (bffFn[0].includes("x-tenant-slug")) {
  fail("web: BFF must not read x-tenant-slug from client");
} else {
  ok("web: BFF ignores x-tenant-slug");
}

if (!exists("apps/web/lib/tenant/assert-workspace-request.ts")) {
  fail("web: assert-workspace-request.ts missing");
} else {
  ok("web: assert-workspace-request.ts");
}

const layout = read("apps/web/app/layout.tsx");
if (layout.includes("catch {") && layout.includes("tenantWrapped = children")) {
  fail("web: layout still soft-fails tenant");
} else if (!layout.includes("assertWorkspaceRequest")) {
  fail("web: layout missing assertWorkspaceRequest");
} else {
  ok("web: layout hard workspace assert");
}

const mainTs = read("apps/api/src/main.ts");
if (/origin:\s*true/.test(mainTs)) {
  fail("api: CORS still uses origin: true");
} else if (!mainTs.includes("isCorsOriginAllowed")) {
  fail("api: CORS not wired to isCorsOriginAllowed");
} else {
  ok("api: CORS allowlist wired");
}

const tenantResolverMw = read("apps/api/src/common/tenant/tenant-resolver.middleware.ts");
if (
  !/outcome\.kind === "outside_workspace"[\s\S]{0,500}authRoute[\s\S]{0,300}TENANT_HOST_INVALID/.test(
    tenantResolverMw,
  )
) {
  fail("api: strict auth must reject outside_workspace/apex (TENANT_HOST_INVALID)");
} else {
  ok("api: strict auth rejects invalid host kinds");
}

const authPolicy = read("apps/api/src/common/auth/auth-route-policy.ts");
if (!authPolicy.includes("isAuthTenantHostStrictRoute")) {
  fail("api: isAuthTenantHostStrictRoute missing");
} else if (!authPolicy.includes("AUTH_WORKSPACE_SESSION_ROUTE")) {
  fail("api: workspace session not in strict routes");
} else {
  ok("api: strict host routes include workspace/session");
}

const authMw = read("apps/api/src/common/middleware/auth.middleware.ts");
if (authMw.includes("AUTH_WORKSPACE_SESSION_ROUTE") && authMw.includes("skipsJwtHostTenantAlignment")) {
  const skipFn = authMw.slice(
    authMw.indexOf("function skipsJwtHostTenantAlignment"),
    authMw.indexOf("const PUBLIC_ROUTES"),
  );
  if (skipFn.includes("AUTH_WORKSPACE_SESSION_ROUTE")) {
    fail("api: workspace session still skips JWT/Host alignment");
  } else {
    ok("api: workspace session requires JWT/Host alignment");
  }
}

const toursSvc = read("apps/web/lib/services/tours.service.ts");
if (!toursSvc.includes("bffBrowserClient") || !toursSvc.includes("BFF.tours")) {
  fail("web: tours.service must use same-origin BFF");
} else {
  ok("web: tours.service → /api/tours BFF");
}

const usersSvc = read("apps/web/lib/services/users.service.ts");
if (!usersSvc.includes("bffBrowserClient") || !usersSvc.includes("BFF.users")) {
  fail("web: users.service must use same-origin BFF");
} else {
  ok("web: users.service → /api/users BFF");
}

const bookingsSvc = read("apps/web/lib/services/bookings.service.ts");
if (!bookingsSvc.includes("bffBrowserClient") || !bookingsSvc.includes("BFF.bookings")) {
  fail("web: bookings.service must use same-origin BFF");
} else {
  ok("web: bookings.service → /api/bookings BFF");
}

if (!exists("apps/web/app/api/users/route.ts")) {
  fail("web: missing app/api/users BFF routes");
} else {
  ok("web: app/api/users BFF routes");
}

if (!exists("apps/web/app/api/bookings/route.ts")) {
  fail("web: missing app/api/bookings BFF route");
} else {
  ok("web: app/api/bookings BFF route");
}

const bffMigratedServices = [
  ["registrations.service.ts", "BFF.registrations"],
  ["payments.service.ts", "BFF.paymentsIntent"],
  ["leader-workspace.service.ts", "BFF.dashboardLeaderWorkspace"],
  ["workspace-audit.service.ts", "BFF.workspaceAuditEvents"],
  ["workspace-reconciliation-findings.service.ts", "BFF.workspaceReconciliationFindings"],
];
for (const [file, bffPath] of bffMigratedServices) {
  const svc = read(`apps/web/lib/services/${file}`);
  if (!svc.includes("bffBrowserClient") || !svc.includes(bffPath)) {
    fail(`web: ${file} must use same-origin BFF`);
  } else {
    ok(`web: ${file} → BFF`);
  }
}

const bffRouteChecks = [
  "apps/web/app/api/registrations/route.ts",
  "apps/web/app/api/payments/intent/route.ts",
  "apps/web/app/api/dashboard/leader-workspace/route.ts",
];
for (const route of bffRouteChecks) {
  if (!exists(route)) {
    fail(`web: missing ${route}`);
  } else {
    ok(`web: ${route}`);
  }
}

if (!exists("apps/web/lib/api/bff-proxy.ts") || !read("apps/web/lib/api/bff-proxy.ts").includes("proxyBffGetBlob")) {
  fail("web: bff-proxy must export proxyBffGetBlob for audit export");
} else {
  ok("web: proxyBffGetBlob for audit export");
}

const middleware = read("apps/web/middleware.ts");
if (!middleware.includes("forwardTenantSlug") || !middleware.includes("x-tenant-slug")) {
  fail("web: middleware must inject x-tenant-slug for RSC");
} else {
  ok("web: middleware injects x-tenant-slug");
}

const rootLayout = read("apps/web/app/layout.tsx");
if (!rootLayout.includes("assertWorkspaceRequest")) {
  fail("web: root layout must assert workspace before RSC tenant provider");
} else {
  ok("web: root layout assertWorkspaceRequest");
}

const authPolicy = read("apps/api/src/common/auth/auth-route-policy.ts");
if (
  !authPolicy.includes("AUTH_WORKSPACE_HOST_PROBE_ROUTE") ||
  !authPolicy.includes("workspace-host")
) {
  fail("api: missing GET /api/v2/auth/workspace-host probe route policy");
} else {
  ok("api: workspace-host lightweight probe route");
}

const lookup = read("apps/web/lib/tenant/lookup-workspace-tenant.ts");
if (!lookup.includes("workspace-host")) {
  fail("web: lookup must use GET /api/v2/auth/workspace-host probe");
} else {
  ok("web: lookup uses lightweight workspace-host probe");
}

const tourWizard = read("apps/web/src/components/tours/wizard/TourCreateWizard.tsx");
if (
  !tourWizard.includes("resolveTenantTourFormContract") ||
  !tourWizard.includes("tenantFormContract")
) {
  fail("web: tour wizard must resolve per-tenant form contract");
} else {
  ok("web: tour wizard per-tenant form contract");
}

if (!exists("apps/web/lib/api/bff-browser-client.ts")) {
  fail("web: bff-browser-client.ts missing");
} else {
  ok("web: bff-browser-client.ts");
}

const lookup = read("apps/web/lib/tenant/lookup-workspace-tenant.ts");
if (!lookup.includes("NODE_ENV !== \"production\"")) {
  fail("web: lookup missing production fail-closed");
} else {
  ok("web: lookup fail-closed in production");
}

const apiUp = spawnSync("curl", ["-sf", "http://127.0.0.1:3001/health"], { encoding: "utf8" }).status === 0;
const webUp =
  spawnSync("curl", ["-sf", "-o", "/dev/null", "http://127.0.0.1:3000/"], { encoding: "utf8" }).status ===
  0;

if (apiUp && webUp) {
  const apex = spawnSync(
    "curl",
    ["-sf", "-D", "/tmp/p7-apex-headers.txt", "-o", "/dev/null", "http://127.0.0.1:3000/login"],
    { encoding: "utf8" },
  );
  const apexHeaders = fs.existsSync("/tmp/p7-apex-headers.txt")
    ? fs.readFileSync("/tmp/p7-apex-headers.txt", "utf8")
    : "";
  const apexRewritten =
    apexHeaders.toLowerCase().includes("x-middleware-rewrite: /workspace-not-found") ||
    apexHeaders.includes("x-middleware-rewrite: /workspace-not-found");
  if (!apexRewritten && apex.status === 0) {
    fail("live: bare localhost /login did not rewrite to workspace-not-found");
  } else {
    ok("live: bare localhost /login rewrites to workspace-not-found");
  }

  const unknownApi = spawnSync(
    "curl",
    [
      "-sf",
      "-o",
      "/tmp/p7-unknown.json",
      "-w",
      "%{http_code}",
      "-X",
      "POST",
      "http://127.0.0.1:3001/api/v2/auth/web/phone/preflight",
      "-H",
      "Host: unknown-tenant-phase7.localhost:3001",
      "-H",
      "Content-Type: application/json",
      "-d",
      '{"phone":"+15550000001"}',
    ],
    { encoding: "utf8" },
  );
  if (unknownApi.stdout?.trim() !== "404") {
    fail(`live: unknown tenant preflight → ${unknownApi.stdout}`);
  } else {
    ok("live: unknown tenant Host → 404 API");
  }

  const outsideHost = spawnSync(
    "curl",
    [
      "-sf",
      "-o",
      "/tmp/p7-outside.json",
      "-w",
      "%{http_code}",
      "-X",
      "POST",
      "http://127.0.0.1:3001/api/v2/auth/web/phone/preflight",
      "-H",
      "Host: ws1-rbac.evil.com:3001",
      "-H",
      "Content-Type: application/json",
      "-d",
      '{"phone":"+15550000001"}',
    ],
    { encoding: "utf8" },
  );
  const outsideStatus = outsideHost.stdout?.trim();
  if (outsideStatus !== "400" && outsideStatus !== "403") {
    fail(`live: outside_workspace auth preflight → ${outsideStatus} (expected 400/403)`);
  } else {
    ok(`live: outside_workspace Host → ${outsideStatus} (not 500)`);
  }

  const _corsGood = spawnSync(
    "curl",
    ["-sf", "-D", "/tmp/p7-cors-good.txt", "-o", "/dev/null", "-X", "OPTIONS",
      "http://127.0.0.1:3001/api/v2/auth/web/phone/preflight",
      "-H", "Origin: http://ws1-rbac.localhost:3000",
      "-H", "Access-Control-Request-Method: POST"],
    { encoding: "utf8" },
  );
  const corsGoodHeaders = fs.existsSync("/tmp/p7-cors-good.txt")
    ? fs.readFileSync("/tmp/p7-cors-good.txt", "utf8").toLowerCase()
    : "";
  if (!corsGoodHeaders.includes("access-control-allow-origin")) {
    fail("live: CORS preflight ws1 origin missing Allow-Origin (set CORS_ALLOW_TENANT_SUBORIGINS?)");
  } else {
    ok("live: CORS allows workspace origin");
  }

  const _corsEvil = spawnSync(
    "curl",
    ["-sf", "-D", "/tmp/p7-cors-evil.txt", "-o", "/dev/null", "-X", "OPTIONS",
      "http://127.0.0.1:3001/api/v2/auth/web/phone/preflight",
      "-H", "Origin: https://evil-remediation.example",
      "-H", "Access-Control-Request-Method: POST"],
    { encoding: "utf8" },
  );
  const corsEvilHeaders = fs.existsSync("/tmp/p7-cors-evil.txt")
    ? fs.readFileSync("/tmp/p7-cors-evil.txt", "utf8").toLowerCase()
    : "";
  if (corsEvilHeaders.includes("access-control-allow-origin: https://evil-remediation.example")) {
    fail("live: CORS must not reflect evil origin");
  } else {
    ok("live: CORS denies unknown origin");
  }

  let saw429 = false;
  for (let i = 0; i < 70; i += 1) {
    const probe = spawnSync(
      "curl",
      ["-sf", "-o", "/dev/null", "-w", "%{http_code}",
        "-X", "POST",
        "http://127.0.0.1:3001/api/v2/auth/web/phone/preflight",
        "-H", "Host: probe-rate-phase7.localhost:3001",
        "-H", "Content-Type: application/json",
        "-d", '{"phone":"+15550000001"}'],
      { encoding: "utf8" },
    );
    if (probe.stdout?.trim() === "429") {
      saw429 = true;
      break;
    }
  }
  if (saw429) {
    ok("live: host probe rate limit → 429");
  } else {
    fail("live: host probe did not return 429 after burst (check TENANT_RATE_LIMIT_*)");
  }
} else {
  ok(`live smoke skipped (API up=${apiUp} Web up=${webUp})`);
}

function _runPnpmTest(cwdRel, label) {
  const r = spawnSync("pnpm", ["test"], { cwd: path.join(REPO_ROOT, cwdRel), encoding: "utf8" });
  if (r.status !== 0) {
    fail(`unit: ${label} failed\n${(r.stderr || r.stdout || "").slice(-800)}`);
  } else {
    ok(`unit: ${label}`);
  }
}

const tenantHostBuild = spawnSync("pnpm", ["build"], {
  cwd: path.join(REPO_ROOT, "packages/tenant-host"),
  encoding: "utf8",
});
if (tenantHostBuild.status !== 0) {
  fail("@repo/tenant-host build failed");
} else {
  ok("@repo/tenant-host built");
}

const tenantHostUnit = spawnSync(
  "pnpm",
  ["exec", "node", "--import", "tsx", "--test", "src/parse-workspace-tenant-label.spec.ts"],
  { cwd: path.join(REPO_ROOT, "packages/tenant-host"), encoding: "utf8" },
);
if (tenantHostUnit.status !== 0) {
  fail(`unit: @repo/tenant-host failed\n${(tenantHostUnit.stderr || tenantHostUnit.stdout || "").slice(-800)}`);
} else {
  ok("unit: @repo/tenant-host");
}

if (exists("apps/web/lib/api/bff-error-response.ts")) {
  ok("web: bff-error-response for TENANT_HOST_UNKNOWN");
} else {
  fail("web: bff-error-response.ts missing");
}

const unitWebTenant = spawnSync(
  "pnpm",
  ["exec", "node", "--import", "tsx", "--test", "lib/tenant/runtime-tenant-context.spec.ts"],
  { cwd: path.join(REPO_ROOT, "apps/web"), encoding: "utf8" },
);
if (unitWebTenant.status !== 0) {
  fail(`unit: web runtime-tenant-context failed\n${(unitWebTenant.stderr || unitWebTenant.stdout || "").slice(-800)}`);
} else {
  ok("unit: web runtime-tenant-context");
}

if (failures.length) {
  process.exit(1);
}
