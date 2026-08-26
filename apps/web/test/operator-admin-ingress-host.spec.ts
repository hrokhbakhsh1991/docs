/**
 * Profile B — bare IP staging must serve operator admin routes when PUBLIC_TENANT_FALLBACK_* is set.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveOperatorAdminRootRedirect } from "../src/admin/resolve-operator-admin-root-redirect";
import {
  isOperatorAdminHost,
  isOperatorAdminIngressHost,
} from "../src/tenant/operator-admin-host";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  NODE_ENV: env.NODE_ENV,
  PUBLIC_TENANT_FALLBACK_LABEL: env.PUBLIC_TENANT_FALLBACK_LABEL,
  PUBLIC_TENANT_FALLBACK_HOSTS: env.PUBLIC_TENANT_FALLBACK_HOSTS,
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
});
