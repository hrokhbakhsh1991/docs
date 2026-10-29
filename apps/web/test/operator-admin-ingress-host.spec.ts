/**
 * Profile B — bare IP staging must serve operator admin routes when PUBLIC_TENANT_FALLBACK_* is set.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveOperatorAdminRootRedirect } from "../src/admin/resolve-operator-admin-root-redirect";
import { isOperatorAdminHost, isOperatorAdminIngressHost } from "../src/tenant/operator-admin-host";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  NODE_ENV: env.NODE_ENV,
  PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN,
  TENANT_ROOT_DOMAIN: env.TENANT_ROOT_DOMAIN,
  PUBLIC_TENANT_FALLBACK_LABEL: env.PUBLIC_TENANT_FALLBACK_LABEL,
  PUBLIC_TENANT_FALLBACK_HOSTS: env.PUBLIC_TENANT_FALLBACK_HOSTS,
  OPERATOR_ADMIN_ROOT_HOSTS: env.OPERATOR_ADMIN_ROOT_HOSTS,
  TENANT_SURFACE_ORIGIN_MAP_JSON: env.TENANT_SURFACE_ORIGIN_MAP_JSON,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("operator-admin-ingress-host.spec.ts", () => {
  it("WEB-P8-INGRESS-01 canonical club admin host unchanged", () => {
    assert.equal(isOperatorAdminHost("denali.admin.localhost:3000"), true);
    assert.equal(isOperatorAdminIngressHost("denali.admin.localhost:3000"), true);
  });

  it("WEB-P8-INGRESS-02 bare VPS IP is not canonical admin host", () => {
    assert.equal(isOperatorAdminHost("89.42.210.252:23000"), false);
  });

  it("WEB-P8-INGRESS-03 allowlisted bare IP is operator admin ingress", () => {
    env.NODE_ENV = "production";
    env.PUBLIC_TENANT_FALLBACK_LABEL = "denali";
    env.PUBLIC_TENANT_FALLBACK_HOSTS = "89.42.210.252,127.0.0.1";
    assert.equal(isOperatorAdminIngressHost("89.42.210.252:23000"), true);
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "89.42.210.252:23000",
      }),
      "/dashboard"
    );
  });

  it("WEB-P8-INGRESS-04 unlisted IP stays blocked", () => {
    env.NODE_ENV = "production";
    env.PUBLIC_TENANT_FALLBACK_LABEL = "denali";
    env.PUBLIC_TENANT_FALLBACK_HOSTS = "89.42.210.252";
    assert.equal(isOperatorAdminIngressHost("203.0.113.50:23000"), false);
  });

  it("WEB-P8-INGRESS-05 explicit staging admin alias redirects without claiming the marketing apex", () => {
    env.NODE_ENV = "production";
    env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    env.TENANT_ROOT_DOMAIN = "staging.invalid";
    env.PUBLIC_TENANT_FALLBACK_LABEL = "denali";
    env.PUBLIC_TENANT_FALLBACK_HOSTS = "staging-denali.shenski.com";
    env.OPERATOR_ADMIN_ROOT_HOSTS = "staging-admin-denali.shenski.com";

    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "staging-admin-denali.shenski.com:443",
      }),
      "/dashboard"
    );
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "staging-denali.shenski.com",
      }),
      null
    );
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/settings",
        host: "staging-admin-denali.shenski.com",
      }),
      null
    );
  });

  it("WEB-P8-INGRESS-06 only an explicitly mapped admin surface is accepted", () => {
    env.NODE_ENV = "production";
    env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify({
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
          aliases: {
            admin: [
              { origin: "https://staging-admin-denali.shenski.com", cookieDomain: "shenski.com" },
            ],
            marketing: [
              { origin: "https://staging-denali.shenski.com", cookieDomain: "shenski.com" },
            ],
          },
        },
      ],
    });
    assert.equal(isOperatorAdminIngressHost("admin.denali.staging.test"), true);
    assert.equal(isOperatorAdminIngressHost("staging-admin-denali.shenski.com"), true);
    assert.equal(isOperatorAdminIngressHost("staging-denali.shenski.com"), false);
    assert.equal(isOperatorAdminIngressHost("denali.staging.test"), false);
    assert.equal(isOperatorAdminIngressHost("unknown.staging.test"), false);
  });
});
