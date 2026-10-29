/**
 * Staging env/deploy contract guards — Denali Profile B (89.42.210.252).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert.match(render, /invalid staging second tenant label/);
    assert.match(render, /STAGING_SECOND_TENANT_LABEL[\s\S]*?CANONICAL_TENANT_LABEL/);
    assert.match(render, /missing staging env directory/);
    assert.match(render, /missing staging \$\{app\}\.env/);
    assert.match(render, /staging app port collides with production/);
    assert.doesNotMatch(render, /collect_app_ports "\$STAGING_ENV_DIR"/);

    const routeAssertions = [
      ["admin", "STAGING_WEB_PORT"],
      ["portal", "STAGING_PORTAL_PORT"],
      ["marketing", "STAGING_MARKETING_PORT"],
    ];
    const genericMarketingRoute = caddy.indexOf("http://*.{$PLATFORM_ROOT_DOMAIN}");
    for (const [surface, upstream] of routeAssertions) {
      const host =
        surface === "admin"
          ? "http://staging-admin-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}"
          : surface === "portal"
            ? "http://staging-portal-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}"
            : "http://staging-{$STAGING_SECOND_TENANT_LABEL}.{$PLATFORM_ROOT_DOMAIN}";
      const start = caddy.indexOf(host);
      const end = caddy.indexOf("\nhttp://", start + host.length);
      assert.ok(start >= 0 && start < genericMarketingRoute, `${surface} exact host order`);
      const block = caddy.slice(start, end < 0 ? undefined : end);
      assert.match(
        block,
        new RegExp(
          `STAGING_${surface === "admin" ? "WEB" : surface === "portal" ? "PORTAL" : "MARKETING"}_PORT`
        )
      );
      assert.match(block, new RegExp(`\\{\\$${upstream}\\}`));
      assert.match(block, /header_up Host \{host\}/);
      assert.match(block, /header_up X-Forwarded-Proto https/);
      assert.match(block, /header_up X-Forwarded-Host \{host\}/);
      assert.doesNotMatch(block, /PROD_(?:API|WEB|PORTAL|MARKETING)_PORT/);
      if (surface === "admin") {
        assert.match(block, /@stagingTelegramWebhook path \/webhooks\/telegram\/\*/);
        assert.match(block, /\{\$STAGING_API_PORT\}/);
      }
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
});
