import assert from "node:assert/strict";
import { lookup } from "node:dns/promises";

import { expect, test } from "@playwright/test";

import {
  loadTwoTenantStagingManifest,
  type StagingSurface,
  type StagingTenantLabel,
} from "../../test/fixtures/two-tenant-staging-config.mts";

const manifest = loadTwoTenantStagingManifest();
const surfaces: readonly StagingSurface[] = ["marketing", "admin", "portal"];
const tenantLabels: readonly StagingTenantLabel[] = ["A", "B"];
const expectedIngressAddresses = new Set(manifest.expectedIngressAddresses);

test.describe("two-tenant staging network and TLS", () => {
  test.describe.configure({ mode: "serial" });

  for (const tenantLabel of tenantLabels) {
    for (const surface of surfaces) {
      const origin = manifest.tenants[tenantLabel].hosts[surface];
      const hostname = new URL(origin).hostname;

      test(`${tenantLabel}/${surface}: DNS and strict TLS agree across API and browser`, async ({
        page,
        request,
      }) => {
        const proxyConfigured = [
          "HTTP_PROXY",
          "HTTPS_PROXY",
          "ALL_PROXY",
          "http_proxy",
          "https_proxy",
          "all_proxy",
        ].some((name) => Boolean(process.env[name]?.trim()));
        const noProxyEntries = (process.env.NO_PROXY ?? process.env.no_proxy ?? "")
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);
        const isExcludedFromProxy = noProxyEntries.some(
          (entry) =>
            entry === "*" ||
            entry === hostname.toLowerCase() ||
            (entry.startsWith(".") && hostname.toLowerCase().endsWith(entry))
        );
        assert.ok(
          !proxyConfigured || isExcludedFromProxy,
          `${hostname} must bypass configured proxy via NO_PROXY`
        );

        const resolved = await lookup(hostname, { all: true, verbatim: true });
        expect(resolved.length).toBeGreaterThan(0);
        expect(
          resolved.every((record) => expectedIngressAddresses.has(record.address)),
          `${hostname} resolved outside the approved ingress address list`
        ).toBe(true);

        const apiResponse = await request.get(origin, { maxRedirects: 0, timeout: 20_000 });
        expect(
          apiResponse.status(),
          `${tenantLabel}/${surface} API TLS/HTTP response`
        ).toBeLessThan(400);

        const browserResponse = await page.goto(origin, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        expect(browserResponse, `${tenantLabel}/${surface} browser response`).not.toBeNull();
        expect(
          browserResponse?.status(),
          `${tenantLabel}/${surface} browser HTTP response`
        ).toBeLessThan(400);
        expect(new URL(page.url()).origin).toBe(origin);
      });
    }
  }
});
