#!/usr/bin/env node
/**
 * PSC-001 — platform surface cohesion guard.
 * Default: warn mode (baseline debt, exit 0). Strict: SURFACE_COHESION_GUARD_MODE=strict
 * @see docs/standards/platform-surface-cohesion.mdoc
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STRICT = process.env.SURFACE_COHESION_GUARD_MODE?.trim().toLowerCase() === "strict";

/** @type {string[]} */
const violations = [];

/** @type {string[]} */
const warnings = [];

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function fileExists(rel) {
  try {
    statSync(path.join(REPO_ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

function assertMatch(rel, pattern, message, { baseline = false } = {}) {
  if (!fileExists(rel)) {
    violations.push(`${rel}: missing (required for cohesion check)`);
    return;
  }
  const source = read(rel);
  if (!pattern.test(source)) {
    const msg = `${rel}: ${message}`;
    if (baseline) {
      warnings.push(msg);
    } else {
      violations.push(msg);
    }
  }
}

function assertNoMatch(rel, pattern, message, { baseline = false, allowlist = [] } = {}) {
  if (!fileExists(rel)) {
    return;
  }
  const source = read(rel);
  if (!pattern.test(source)) {
    return;
  }
  for (const allowed of allowlist) {
    if (source.includes(allowed)) {
      // still flag file if pattern exists outside allowlist — keep simple: warn if any match
    }
  }
  const msg = `${rel}: ${message}`;
  if (baseline) {
    warnings.push(msg);
  } else {
    violations.push(msg);
  }
}

function listTsFiles(dir, { skipSpec = true } = {}) {
  const abs = path.join(REPO_ROOT, dir);
  /** @type {string[]} */
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.name.endsWith(".ts") && (!skipSpec || !ent.name.endsWith(".spec.ts"))) {
        out.push(full);
      }
    }
  };
  if (statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    walk(abs);
  }
  return out;
}

// --- M+P positive checks (must pass now) ---

assertMatch(
  "apps/marketing/src/tenant/resolve-marketing-bootstrap.ts",
  /resolveGuestSurfaceBootstrapForHost/,
  "marketing bootstrap must delegate guest-surface-host"
);

assertMatch(
  "apps/portal/src/tenant/resolve-portal-bootstrap.ts",
  /resolveGuestSurfaceBootstrapForHost/,
  "portal bootstrap must delegate guest-surface-host"
);

assertMatch(
  "apps/marketing/src/tenant/fetch-public-tenant-branding.ts",
  /fetchGuestPublicTenantBrandingForHost/,
  "marketing branding must delegate guest-surface-host"
);

assertMatch(
  "apps/portal/src/tenant/fetch-public-tenant-branding.ts",
  /fetchGuestPublicTenantBrandingForHost/,
  "portal branding must delegate guest-surface-host"
);

assertMatch(
  "apps/marketing/src/env.ts",
  /resolveTourOpsApiBaseUrl/,
  "marketing env must re-export resolveTourOpsApiBaseUrl from guest-surface-host"
);

assertMatch(
  "apps/portal/src/env.ts",
  /resolveTourOpsApiBaseUrl/,
  "portal env must re-export resolveTourOpsApiBaseUrl from guest-surface-host"
);

// --- Web Phase 1a/1b (must pass — GSH parity) ---

assertMatch(
  "apps/web/src/urban/urban-api-base.ts",
  /from "@app-tour\/guest-surface-host"/,
  "urban-api-base must re-export resolveTourOpsApiBaseUrl from guest-surface-host"
);

assertNoMatch(
  "apps/web/src/tenant/fetch-public-tenant-context.server.ts",
  /function apiBaseUrl\(\)/,
  "web tenant-context must not duplicate apiBaseUrl() — use GSH resolver"
);

assertMatch(
  "apps/web/src/tenant/fetch-public-tenant-branding.server.ts",
  /fetchGuestPublicTenantBrandingForHost|fetchPublicTenantBrandingForHost as fetchGuest/,
  "web branding must delegate guest-surface-host"
);

assertMatch(
  "apps/web/src/tenant/fetch-public-tenant-branding.server.ts",
  /assertGuestBffProductionConfig/,
  "web branding must wire assertGuestBffProductionConfig onBeforeFetch"
);

assertMatch(
  "apps/web/app/api/public/tenant-branding/route.ts",
  /fetchPublicTenantBrandingForHost/,
  "web public tenant-branding BFF must delegate server branding helper (GSH chain)"
);

assertNoMatch(
  "apps/web/app/api/public/tenant-branding/route.ts",
  /backendRes\.ok|\/public\/tenant-branding`/,
  "web public tenant-branding BFF must not duplicate raw API fetch"
);

assertMatch(
  "apps/web/src/tenant/resolve-admin-bootstrap.server.ts",
  /resolveAdminBootstrapForHost/,
  "web admin bootstrap wrapper must delegate guest-surface-host ASB-001"
);

assertMatch(
  "apps/web/src/tenant/tenant-kernel.server.ts",
  /resolveAdminBootstrapForWebHost/,
  "web tenant-kernel async bootstrap must delegate ASB-001"
);

assertNoMatch(
  "apps/web/src/tenant/tenant-kernel.server.ts",
  /fetchPublicTenantContextForHost/,
  "web tenant-kernel must not use legacy fetchPublicTenantContextForHost after ASB-001"
);

assertMatch(
  "apps/web/src/auth/identity-bff-headers.ts",
  /resolveAdminBootstrapForWebHost/,
  "operator identity BFF must delegate ASB-001 admin bootstrap"
);

assertNoMatch(
  "apps/web/src/auth/identity-bff-headers.ts",
  /fetchPublicTenantContextForHost/,
  "operator identity BFF must not use legacy fetchPublicTenantContextForHost after ASB-001"
);

// --- Web Phase 1c (must pass — no hostname plugin heuristics) ---

assertNoMatch(
  "apps/web/src/tenant/tenant-kernel.shared.ts",
  /hostname\.startsWith\("denali\."\)/,
  "must not resolve pluginId from denali. hostname prefix — use resolveDevPluginIdForTenantId"
);

assertNoMatch(
  "apps/web/src/tenant/tenant-kernel.shared.ts",
  /hostname\.startsWith\("urban\."\)/,
  "must not resolve pluginId from urban. hostname prefix — use resolveDevPluginIdForTenantId"
);

assertMatch(
  "apps/web/src/tenant/tenant-kernel.shared.ts",
  /resolveDevPluginIdForTenantId/,
  "web tenant-kernel must resolve dev pluginId from guest-surface-host codegen map"
);

// --- Web Phase 1d (must pass — SDK catalog paths) ---

assertMatch(
  "apps/web/src/denali/denali-catalog-client.ts",
  /resolveCatalogTourApiPath/,
  "denali catalog client must use workspace-sdk resolveCatalogTourApiPath"
);

assertMatch(
  "apps/web/src/urban/urban-catalog-client.ts",
  /resolveCatalogListApiPath/,
  "urban catalog client must use workspace-sdk resolveCatalogListApiPath"
);

assertNoMatch(
  "apps/web/src/denali/denali-catalog-client.ts",
  /\/denali\/catalog/,
  "denali catalog client must not hardcode /denali/catalog path"
);

assertNoMatch(
  "apps/web/src/urban/urban-catalog-client.ts",
  /\/urban\/catalog/,
  "urban catalog client must not hardcode /urban/catalog path"
);

const WEB_CATALOG_PATH_PATTERN = /\/denali\/catalog|\/urban\/catalog/;

for (const file of listTsFiles("apps/web/src")) {
  const rel = path.relative(REPO_ROOT, file);
  if (rel.endsWith(".generated.ts")) {
    continue;
  }
  const content = readFileSync(file, "utf8");
  if (WEB_CATALOG_PATH_PATTERN.test(content)) {
    violations.push(`${rel}: hardcoded workspace catalog API path — use SDK resolveCatalog*ApiPath`);
  }
}

// --- Doc / guard self-check ---

assertMatch(
  "docs/standards/platform-surface-cohesion.mdoc",
  /PSC-001/,
  "platform-surface-cohesion standard must exist"
);

assertMatch(
  "docs/dev/platform-surface-cohesion-smoke-matrix.yaml",
  /SMK-PSC-01/,
  "platform-surface-cohesion smoke matrix must exist (Phase 3)"
);

// --- Report ---

if (warnings.length > 0) {
  console.warn(`guard-surface-cohesion: ${warnings.length} baseline warning(s) (Phase 1 targets):`);
  for (const w of warnings) {
    console.warn(`  [warn] ${w}`);
  }
}

if (violations.length > 0) {
  console.error(`guard-surface-cohesion: FAIL (${violations.length})`);
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

if (STRICT && warnings.length > 0) {
  console.error(
    `guard-surface-cohesion: FAIL — ${warnings.length} baseline warning(s) in strict mode (clear Phase 1 debt first)`
  );
  process.exit(1);
}

const mode = STRICT ? "strict" : "warn";
console.log(`guard-surface-cohesion: PASS (${mode} mode, ${warnings.length} baseline warning(s))`);

const smokeGuard = spawnSync("node", ["scripts/guards/guard-surface-cohesion-smoke.mjs"], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
if (smokeGuard.status !== 0) {
  process.exit(smokeGuard.status ?? 1);
}
