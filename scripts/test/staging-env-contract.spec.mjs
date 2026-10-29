/**
 * Staging env/deploy contract guards — Denali Profile B (89.42.210.252).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STAGING_IP = "89.42.210.252";
const LEGACY_IP = "89.45.89.206";

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("staging-env-contract", () => {
  it("REG-STG-ENV-01 wave-c bootstrap sets denali fallback, MinIO public endpoint, portal internal URL", () => {
    const sh = read("scripts/wave-c-staging-env-bootstrap.sh");
    assert.match(sh, /STAGING_PUBLIC_IP="\$\{STAGING_PUBLIC_IP:-89\.42\.210\.252\}"/);
    assert.match(sh, /MINIO_PUBLIC_HOST=\$\{STAGING_PUBLIC_MINIO_HOST\}/);
    assert.match(sh, /MINIO_PUBLIC_ENDPOINT=https:\/\/\$\{STAGING_PUBLIC_MINIO_HOST\}/);
    assert.match(sh, /PORTAL_INTERNAL_URL=http:\/\/127\.0\.0\.1:23003/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_LABEL=denali/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_HOSTS=\$\{FALLBACK_HOSTS\}/);
    assert.doesNotMatch(sh, new RegExp(LEGACY_IP));
  });

  it("REG-STG-ENV-02 profile-b sync sets api MINIO_PUBLIC_ENDPOINT and portal PORTAL_INTERNAL_URL", () => {
    const sh = read("scripts/vps-deploy/sync-staging-profile-b-public-urls.sh");
    assert.match(sh, /MINIO_PUBLIC_ENDPOINT/);
    assert.match(sh, /MINIO_PUBLIC_ENDPOINT "https:\/\/\$\{MINIO_PUBLIC_HOST\}"/);
    assert.match(sh, /MINIO_PUBLIC_HOST "\$MINIO_PUBLIC_HOST"/);
    assert.match(sh, /PORTAL_INTERNAL_URL/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_LABEL "\$CLUB_LABEL"/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_HOSTS/);
    assert.match(sh, /STAGING_ADMIN_HOST=.*staging-admin-\$\{CLUB_LABEL\}/);
    assert.match(sh, /web\.env" OPERATOR_ADMIN_ROOT_HOSTS "\$STAGING_ADMIN_HOST"/);
    assert.match(sh, /PORTAL_INTERNAL_URL "http:\/\/127\.0\.0\.1:\$\{PTL_PORT\}"/);
    assert.match(sh, /MARKETING_PUBLIC_BASE_URL/);
    assert.match(sh, /marketing\.env.*MARKETING_PUBLIC_BASE_URL/);
    assert.match(sh, /marketing\.env.*MARKETING_PUBLIC_BASE_URL_ALLOWLIST/);
    assert.match(sh, /domain.*!=.*localhost/);
  });

  it("REG-STG-ENV-03 active staging deploy scripts default to canonical staging IP", () => {
    const paths = [
      "scripts/vps-deploy/bootstrap-staging.sh",
      "scripts/vps-deploy/sync-staging-web-build.sh",
      "scripts/p8-staging-remote-smoke.sh",
      "scripts/p10-vps-smoke.sh",
      "scripts/smoke-p8-profile-b.mjs",
    ];
    for (const rel of paths) {
      const text = read(rel);
      assert.match(text, new RegExp(STAGING_IP), `${rel} missing canonical staging IP default`);
      assert.doesNotMatch(text, new RegExp(LEGACY_IP), `${rel} still references legacy staging IP`);
    }
  });

  it("REG-STG-ENV-04 staging env examples document denali + canonical IP", () => {
    const apiExample = read("deploy/vps/env/api.env.example");
    const marketingExample = read("deploy/vps/env/marketing.env.example");
    const webExample = read("deploy/vps/env/web.env.example");
    assert.match(apiExample, /PUBLIC_TENANT_FALLBACK_LABEL=denali/);
    assert.match(apiExample, new RegExp(`${STAGING_IP},127\\.0\\.0\\.1`));
    assert.match(marketingExample, new RegExp(STAGING_IP));
    assert.match(webExample, /OPERATOR_ADMIN_ROOT_HOSTS/);
    assert.doesNotMatch(apiExample, new RegExp(LEGACY_IP));
    assert.doesNotMatch(marketingExample, new RegExp(LEGACY_IP));
  });

  it("REG-STG-ENV-05 renders the configured public portal host for Caddy", () => {
    const render = read("scripts/vps-deploy/render-caddy-env.sh");
    const caddy = read("deploy/vps/caddy/Caddyfile");
    assert.match(render, /PORTAL_PUBLIC_BASE_URL=.*portal\.env/);
    assert.match(render, /CANONICAL_PORTAL_HOST/);
    assert.match(render, /invalid canonical portal host/);
    assert.match(caddy, /http:\/\/\{\$CANONICAL_PORTAL_HOST\}/);
    assert.match(caddy, /http:\/\/\{\$MINIO_PUBLIC_HOST\}/);
    assert.match(caddy, /reverse_proxy 127\.0\.0\.1:\{\$MINIO_PORT\}/);
    assert.match(caddy, /header_up X-Forwarded-Host \{host\}/);
  });

  it("REG-STG-ENV-07 routes exact second-tenant hosts only to staging upstreams", () => {
    const render = read("scripts/vps-deploy/render-caddy-env.sh");
    const caddy = read("deploy/vps/caddy/Caddyfile");
    assert.match(render, /STAGING_SECOND_TENANT_LABEL=.*STAGING_SECOND_TENANT_LABEL/);
    assert.match(render, /STAGING_SECOND_TENANT_LABEL=\$\{STAGING_SECOND_TENANT_LABEL\}/);
    assert.match(render, /STAGING_SECOND_TENANT_ENABLED=\$\{STAGING_SECOND_TENANT_ENABLED\}/);
    assert.match(render, /STAGING_SECOND_TENANT_ENABLED:-false/);
    assert.match(render, /must be true or false/);
    assert.match(render, /invalid staging second tenant label/);
    assert.match(render, /STAGING_SECOND_TENANT_LABEL[\s\S]*?CANONICAL_TENANT_LABEL/);
    assert.match(render, /missing staging env directory/);
    assert.match(render, /missing staging \$\{app\}\.env/);
    assert.match(render, /staging app port collides with production/);
    assert.doesNotMatch(render, /collect_app_ports "\$STAGING_ENV_DIR"/);

    const routeAssertions = [
      ["A", "admin", "CANONICAL_TENANT_LABEL", "STAGING_WEB_PORT", false],
      ["B", "admin", "STAGING_SECOND_TENANT_LABEL", "STAGING_WEB_PORT", true],
      ["A", "portal", "CANONICAL_TENANT_LABEL", "STAGING_PORTAL_PORT", false],
      ["B", "portal", "STAGING_SECOND_TENANT_LABEL", "STAGING_PORTAL_PORT", true],
      ["A", "marketing", "CANONICAL_TENANT_LABEL", "STAGING_MARKETING_PORT", false],
      ["B", "marketing", "STAGING_SECOND_TENANT_LABEL", "STAGING_MARKETING_PORT", true],
    ];
    for (const [tenant, surface, label, upstream, gated] of routeAssertions) {
      const host =
        surface === "admin"
          ? `https://admin.{\$${label}}.staging.test`
          : surface === "portal"
            ? `https://portal.{\$${label}}.staging.test`
            : `https://{\$${label}}.staging.test`;
      const start = caddy.indexOf(host);
      const end = caddy.indexOf("\n\n", start + host.length);
      assert.ok(start >= 0, `${tenant} ${surface} private HTTPS host`);
      const block = caddy.slice(start, end < 0 ? undefined : end);
      assert.match(block, /tls internal/);
      assert.match(block, new RegExp(`\\{\\$${upstream}\\}`));
      assert.match(block, /header_up Host \{host\}/);
      assert.match(block, /header_up X-Forwarded-Proto https/);
      assert.match(block, /header_up X-Forwarded-Host \{host\}/);
      assert.doesNotMatch(block, /PROD_(?:API|WEB|PORTAL|MARKETING)_PORT/);
      if (gated) {
        assert.match(
          block,
          /@stagingSecondTenantDisabled expression `\{env\.STAGING_SECOND_TENANT_ENABLED\} != "true"`/
        );
        assert.match(
          block,
          /handle @stagingSecondTenantDisabled \{\s*respond "staging second tenant ingress is disabled" 503/s
        );
        assert.ok(
          block.indexOf('respond "staging second tenant ingress is disabled" 503') <
            block.indexOf("handle {")
        );
      } else {
        assert.doesNotMatch(block, /STAGING_SECOND_TENANT_ENABLED/);
      }
      if (surface === "admin" && tenant === "A") {
        assert.match(block, /@stagingTelegramWebhook path \/webhooks\/telegram\/\*/);
        assert.match(block, /\{\$STAGING_API_PORT\}/);
      }
      if (surface === "admin" && tenant === "B") {
        assert.doesNotMatch(block, /STAGING_API_PORT|stagingTelegramWebhook/);
      }
    }
  });

  it("REG-STG-ENV-08 documents private TLS trust and avoids opening origin 443 publicly", () => {
    const readme = read("deploy/vps/caddy/README.md");
    const ufw = read("scripts/vps-deploy/verify-ufw-four-process.sh");
    assert.match(readme, /Private two-tenant staging ingress/);
    assert.match(readme, /trust it there; do not disable certificate validation/);
    assert.match(readme, /keep origin TCP\/443 closed to the public internet/);
    assert.match(readme, /Never use `curl -k`/);
    assert.doesNotMatch(ufw, /ufw allow 80,443\/tcp/);
    assert.match(ufw, /keep private-staging 443 closed publicly/);
  });

  it("REG-STG-ENV-09 preserves the existing public A marketing staging route", () => {
    const caddy = read("deploy/vps/caddy/Caddyfile");
    const start = caddy.indexOf("http://staging-{$CANONICAL_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}");
    const end = caddy.indexOf("\n\n", start);
    const block = caddy.slice(start, end < 0 ? undefined : end);
    assert.ok(start >= 0, "A marketing staging host remains explicit");
    assert.match(block, /\{\$STAGING_MARKETING_PORT\}/);
    assert.doesNotMatch(block, /PROD_MARKETING_PORT/);
  });

  it("REG-STG-ENV-10 fails closed on legacy public B names before wildcard routes", () => {
    const caddy = read("deploy/vps/caddy/Caddyfile");
    const genericMarketingRoute = caddy.indexOf("http://*.{$PLATFORM_ROOT_DOMAIN}");
    const routes = [
      "http://staging-admin-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}",
      "http://staging-portal-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}",
      "http://staging-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}",
    ];
    for (const host of routes) {
      const start = caddy.indexOf(host);
      const end = caddy.indexOf("\n\n", start + host.length);
      const block = caddy.slice(start, end < 0 ? undefined : end);
      assert.ok(start >= 0, `${host} has an explicit tombstone`);
      assert.ok(start < genericMarketingRoute, `${host} precedes the marketing catch-all`);
      assert.match(block, /respond "private staging ingress required" 503/);
      assert.doesNotMatch(block, /reverse_proxy/);
    }
  });

  it("REG-STG-ENV-06 shares sibling-host member sessions through the staging parent", () => {
    const sync = read("scripts/vps-deploy/sync-staging-profile-b-public-urls.sh");
    assert.match(sync, /MEMBER_SESSION_COOKIE_NAME atour_mb_session_staging/);
    assert.match(sync, /MEMBER_SESSION_COOKIE_DOMAIN shenski\.com/);
    assert.match(sync, /sed -i .*MEMBER_SESSION_COOKIE_HOST_ONLY=.*marketing\.env/);
    assert.match(sync, /marketing\.env.*MEMBER_SESSION_COOKIE_NAME/);
    assert.match(sync, /portal\.env.*MEMBER_SESSION_COOKIE_NAME/);
    const bootstrap = read("scripts/vps-deploy/bootstrap-staging.sh");
    assert.match(bootstrap, /MEMBER_SESSION_COOKIE_NAME atour_mb_session_staging/);
    assert.match(bootstrap, /MEMBER_SESSION_COOKIE_DOMAIN shenski\.com/);
    assert.match(bootstrap, /sed -i .*MEMBER_SESSION_COOKIE_HOST_ONLY=.*marketing\.env/);
  });

  it("REG-STG-ENV-11 validates the approved origin map from api.env without writing env files", () => {
    const envDir = mkdtempSync(resolve(tmpdir(), "staging-origin-map-"));
    try {
      const map = {
        version: 1,
        tenants: [
          {
            tenantId: "00000000-0000-4000-8000-000000000003",
            origins: {
              admin: "https://admin.denali.staging.test",
              marketing: "https://denali.staging.test",
              portal: "https://portal.denali.staging.test",
            },
            cookieDomain: "denali.staging.test",
          },
          {
            tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
            origins: {
              admin: "https://admin.qa2.staging.test",
              marketing: "https://qa2.staging.test",
              portal: "https://portal.qa2.staging.test",
            },
            cookieDomain: "qa2.staging.test",
          },
        ],
      };
      writeFileSync(
        resolve(envDir, "api.env"),
        `TENANT_SURFACE_ORIGIN_MAP_JSON=${JSON.stringify(map)}\n`
      );
      const result = spawnSync(
        "bash",
        [
          resolve(ROOT, "scripts/vps-deploy/sync-staging-profile-b-public-urls.sh"),
          "--validate-only",
        ],
        { encoding: "utf8", env: { ...process.env, ENV_DIR: envDir } }
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /tenant surface origin map valid/);
      assert.deepEqual(
        readFileSync(resolve(envDir, "api.env"), "utf8"),
        `TENANT_SURFACE_ORIGIN_MAP_JSON=${JSON.stringify(map)}\n`
      );
      assert.deepEqual(readdirSync(envDir), ["api.env"]);
    } finally {
      rmSync(envDir, { recursive: true, force: true });
    }
  });

  it("REG-STG-ENV-13 keeps the origin map valid when sourced by every staging service", () => {
    const envDir = mkdtempSync(resolve(tmpdir(), "staging-origin-map-shell-env-"));
    try {
      const map = {
        version: 1,
        tenants: [
          {
            tenantId: "00000000-0000-4000-8000-000000000003",
            origins: {
              admin: "https://admin.denali.staging.test",
              marketing: "https://denali.staging.test",
              portal: "https://portal.denali.staging.test",
            },
            cookieDomain: "denali.staging.test",
          },
          {
            tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
            origins: {
              admin: "https://admin.qa2.staging.test",
              marketing: "https://qa2.staging.test",
              portal: "https://portal.qa2.staging.test",
            },
            cookieDomain: "qa2.staging.test",
          },
        ],
      };
      const expected = JSON.stringify(map);
      writeFileSync(resolve(envDir, "api.env"), `TENANT_SURFACE_ORIGIN_MAP_JSON=${expected}\n`);
      for (const app of ["web", "marketing", "portal"]) {
        writeFileSync(resolve(envDir, `${app}.env`), "PORT=23000\n");
      }

      const sync = spawnSync(
        "bash",
        [resolve(ROOT, "scripts/vps-deploy/sync-staging-profile-b-public-urls.sh")],
        { encoding: "utf8", env: { ...process.env, ENV_DIR: envDir } }
      );
      assert.equal(sync.status, 0, sync.stderr);
      assert.match(sync.stdout, /private staging host map enabled/);
      assert.match(sync.stdout, /map_sha256=[a-f0-9]{64}/);
      assert.match(readFileSync(resolve(envDir, "api.env"), "utf8"), /^APP_INFRA_PROFILE=staging$/m);

      const repeatSync = spawnSync(
        "bash",
        [resolve(ROOT, "scripts/vps-deploy/sync-staging-profile-b-public-urls.sh")],
        { encoding: "utf8", env: { ...process.env, ENV_DIR: envDir } }
      );
      assert.equal(repeatSync.status, 0, repeatSync.stderr);
      assert.match(readFileSync(resolve(envDir, "api.env"), "utf8"), /^APP_INFRA_PROFILE=staging$/m);

      for (const app of ["api", "web", "marketing", "portal"]) {
        const sourced = spawnSync(
          "bash",
          [
            "-c",
            "set -a; source \"$1\"; node -e 'JSON.parse(process.env.TENANT_SURFACE_ORIGIN_MAP_JSON)'",
            "source-env-contract",
            resolve(envDir, `${app}.env`),
          ],
          { encoding: "utf8" }
        );
        assert.equal(
          sourced.status,
          0,
          `${app}.env did not preserve valid JSON: ${sourced.stderr}`
        );
      }

      const stored = readFileSync(resolve(envDir, "api.env"), "utf8");
      const storedJson = stored.match(/^TENANT_SURFACE_ORIGIN_MAP_JSON='(.*)'$/m)?.[1];
      assert.ok(storedJson, "origin map is persisted as a shell-safe quoted JSON value");
      const storedMap = JSON.parse(storedJson);
      assert.deepEqual(storedMap.tenants[0].aliases, {
        admin: [
          { origin: "https://staging-admin-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
        marketing: [{ origin: "https://staging-denali.shenski.com", cookieDomain: "shenski.com" }],
        portal: [
          { origin: "https://staging-portal-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
      });
    } finally {
      rmSync(envDir, { recursive: true, force: true });
    }
  });

  it("REG-STG-ENV-14 probes the configured, explicitly mapped tenant-A admin ingress", () => {
    const smoke = read("scripts/vps-deploy/smoke-four-process.sh");
    assert.match(smoke, /web\.env" OPERATOR_ADMIN_ROOT_HOSTS/);
    assert.match(smoke, /resolve-staging-admin-smoke-host\.mjs/);
    assert.doesNotMatch(smoke, /\?\.origins\?\.admin/);
  });

  it("REG-STG-ENV-15 separates four-process health smoke from app-role RLS audit", () => {
    const workflow = read(".github/workflows/deploy-staging.yml");
    const audit = read("scripts/vps-deploy/verify-staging-rls-remote.sh");
    assert.match(
      workflow,
      /name: Staging four-process health smoke[\s\S]*?run: bash scripts\/p10-staging-remote-gate\.sh/
    );
    assert.match(
      workflow,
      /name: Staging app-role RLS catalog verification[\s\S]*?run: bash scripts\/vps-deploy\/verify-staging-rls-remote\.sh/
    );
    assert.match(audit, /tour_db_staging\|app_tour\|f\|f/);
    assert.match(audit, /STAGING_RLS_CATALOG_OK core_tables=9/);
    assert.match(audit, /NOT c\.relforcerowsecurity/);
    assert.doesNotMatch(audit, /echo .*DATABASE_URL|printf .*DATABASE_URL/);
  });

  it("REG-STG-ENV-12 runs origin-map preflight before stopping staging units", () => {
    const install = read("scripts/vps-deploy/install-staging-artifact.sh");
    const validate = install.indexOf('sync-staging-profile-b-public-urls.sh" --validate-only');
    const stop = install.indexOf('log "stop staging units"');
    assert.ok(validate >= 0, "origin-map preflight exists");
    assert.ok(stop >= 0, "service stop exists");
    assert.ok(validate < stop, "invalid config must fail before stopping the stack");
  });
});
