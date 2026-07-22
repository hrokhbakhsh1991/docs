/**
 * SK1.C — freeze @app-tour/tenant-kernel public barrel.
 * @see docs/phase-saas-kernel/appendices/SK1_TENANT_AUTHZ_CONTRACTS.md §3 / §5 SK1.C
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_SRC = join(PKG_ROOT, "src/index.ts");
const SRC_ROOT = join(PKG_ROOT, "src");

/** Runtime + type symbols exported from src/index.ts — keep in sync with SK1 §3. */
const ALLOWED_EXPORT_SYMBOLS = new Set([
  "DEFAULT_TENANT_HOST_RESERVED_LABELS",
  "parseReservedLabelsCsv",
  "TENANT_MAX_HOST_LENGTH",
  "TENANT_SUBDOMAIN_REGEX",
  "normalizeRootDomain",
  "parseWorkspaceTenantLabelFromHost",
  "resolveWorkspaceSlugFromNormalizedHost",
  "WorkspaceTenantLabelOutcome",
  "buildDevMarketingPublicBaseUrl",
  "BuildDevMarketingPublicBaseUrlInput",
  "buildDevPortalPublicBaseUrl",
  "BuildDevPortalPublicBaseUrlInput",
  "formatCustomApexSurfaceUrl",
  "tryParseCustomApexHost",
  "CustomApexSurface",
  "FormatCustomApexSurfaceUrlInput",
  "ParsedCustomApexHost",
  "resolveMemberSessionCookieDomain",
  "isClubAdminHost",
  "isPlatformAdminHost",
  "parseMultiLevelTenantHost",
  "MultiLevelTenantHostOutcome",
  "RESET_RLS_TENANT_SQL",
  "RLS_TENANT_SETTING",
  "SET_LOCAL_RLS_TENANT_SQL",
  "TenantRoute",
  "TenantTier",
  "TenantRouteRow",
  "resolveTenantRoute",
  "TENANT_ROUTE_MISCONFIGURED",
  "ResolveTenantRouteOptions",
  "TenantConnectionRouter",
  "TenantRouteLookup",
]);

const FORBIDDEN_BARREL_SYMBOLS = [
  "resolveTenantContextFromRequest",
  "parseJwtBearer",
  "tryParseDevBearerToken",
  "createPrisma",
  "PrismaClient",
];

const FORBIDDEN_SRC_IMPORT =
  /from\s+["'](@prisma\/client|@nestjs\/|@apps\/|apps\/api|apps\/web|apps\/portal)/;

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

function parseExportedSymbols(indexSrc: string): string[] {
  const symbols: string[] = [];
  const typeExport = /export\s+type\s+\{\s*([^}]+)\s*\}/g;
  const valueExport = /export\s+\{\s*([^}]+)\s*\}/g;
  for (const re of [typeExport, valueExport]) {
    for (const match of indexSrc.matchAll(re)) {
      const body = match[1] ?? "";
      for (const part of body.split(",")) {
        const token = part.trim();
        if (token.length === 0) continue;
        const name = token
          .replace(/^type\s+/, "")
          .replace(/\s+as\s+\w+$/, "")
          .trim();
        if (name.length > 0) symbols.push(name);
      }
    }
  }
  return symbols;
}

describe("SK1.C tenant-kernel public API freeze", () => {
  it("barrel exports exactly the SK1 allowlist (no silent additions)", () => {
    const src = readFileSync(INDEX_SRC, "utf8");
    assert.doesNotMatch(src, /export\s+\*\s+from/);
    const exported = parseExportedSymbols(src);
    assert.ok(exported.length > 0, "expected parsed exports from index.ts");
    for (const name of exported) {
      assert.ok(
        ALLOWED_EXPORT_SYMBOLS.has(name),
        `unexpected public export ${name} — update SK1 allowlist deliberately`,
      );
    }
    for (const name of ALLOWED_EXPORT_SYMBOLS) {
      assert.ok(exported.includes(name), `missing required public export ${name}`);
    }
    assert.equal(exported.length, ALLOWED_EXPORT_SYMBOLS.size);
  });

  it("barrel does not export API ingress / Prisma symbols", () => {
    const src = readFileSync(INDEX_SRC, "utf8");
    for (const name of FORBIDDEN_BARREL_SYMBOLS) {
      assert.doesNotMatch(src, new RegExp(`\\b${name}\\b`));
    }
  });

  it("src tree has no Prisma / Nest / apps package imports", () => {
    for (const file of collectTsFiles(SRC_ROOT)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        FORBIDDEN_SRC_IMPORT,
        `forbidden import in ${file.slice(PKG_ROOT.length + 1)}`,
      );
    }
  });
});
