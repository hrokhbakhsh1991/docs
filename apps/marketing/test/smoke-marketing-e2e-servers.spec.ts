import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const marketingRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(marketingRoot, "../..");

describe("smoke-marketing-e2e-servers", () => {
  it("exposes Playwright readiness only after catalog route warmup", () => {
    const runner = readFileSync(
      resolve(marketingRoot, "scripts/smoke-marketing-e2e-servers.mjs"),
      "utf8"
    );
    const config = readFileSync(resolve(marketingRoot, "playwright.marketing.config.ts"), "utf8");
    const nextConfig = readFileSync(resolve(marketingRoot, "next.config.ts"), "utf8");
    const portalNextConfig = readFileSync(resolve(repoRoot, "apps/portal/next.config.ts"), "utf8");
    const marketingResolveLocale = readFileSync(
      resolve(marketingRoot, "src/i18n/resolve-locale.ts"),
      "utf8"
    );
    const marketingBranding = readFileSync(
      resolve(marketingRoot, "src/tenant/fetch-public-tenant-branding.ts"),
      "utf8"
    );
    const portalResolveLocale = readFileSync(
      resolve(repoRoot, "apps/portal/src/i18n/resolve-locale.ts"),
      "utf8"
    );
    const portalBranding = readFileSync(
      resolve(repoRoot, "apps/portal/src/tenant/fetch-public-tenant-branding.ts"),
      "utf8"
    );
    const portalRegistrationFlow = readFileSync(
      resolve(repoRoot, "apps/portal/src/catalog/public-catalog-registration-flow.tsx"),
      "utf8"
    );

    assert.match(runner, /MARKETING_SMOKE_READY_PORT/);
    assert.match(runner, /readinessReady = true/);
    assert.match(runner, /attemptSettled/);
    assert.match(runner, /retryOnce/);
    assert.match(runner, /browserWarmHeaders/);
    assert.match(runner, /text\/html,application\/xhtml\+xml/);
    assert.match(runner, /portalRegistrationPrimeTimeoutMs = 240_000/);
    assert.match(runner, /App Router page warmup must complete before readiness/);
    assert.doesNotMatch(runner, /resolveOnTimeout: true/);
    assert.match(runner, /warmPortalPath\(`\/catalog\/\$\{smokePublishedTourId\}\/register`, "GET", null, \{/);
    assert.match(runner, /warmMarketingPath\("\/tours"\)/);
    assert.match(runner, /warmMarketingPath\(`\/tours\/\$\{smokePublishedTourId\}`\)/);
    assert.match(runner, /NEXT_FONT_OFFLINE: "1"/);
    assert.match(runner, /timed out/);
    assert.doesNotMatch(runner, /portal register page warm skipped/);
    assert.doesNotMatch(runner, /marketing tours warm skipped/);
    assert.doesNotMatch(runner, /marketing detail warm skipped/);
    assert.match(config, /marketingReadinessUrl/);
    assert.match(config, /MARKETING_SMOKE_READY_PORT/);
    assert.match(nextConfig, /NEXT_FONT_OFFLINE === "1"/);
    assert.match(nextConfig, /app-fonts\.offline\.ts/);
    assert.match(portalNextConfig, /NEXT_FONT_OFFLINE === "1"/);
    assert.match(portalNextConfig, /app-fonts\.offline\.ts/);
    assert.match(marketingResolveLocale, /fetchPublicTenantBrandingForHost\(host, null\)/);
    assert.match(portalResolveLocale, /fetchPublicTenantBrandingForHost\(host, null\)/);
    assert.match(marketingBranding, /locale === undefined \?/);
    assert.match(portalBranding, /locale === undefined \?/);
    assert.match(portalRegistrationFlow, /data-registration-bootstrap-pending/);
    assert.match(portalRegistrationFlow, /PublicCatalogRegistrationFlowReady/);
    assert.doesNotMatch(portalRegistrationFlow, /use\(ensureWorkspaceRegistrationFlowClient/);
  });
});
