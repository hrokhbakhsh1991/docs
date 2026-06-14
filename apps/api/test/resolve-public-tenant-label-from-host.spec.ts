import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBarePublicIngressHost,
  resolvePublicTenantLabelFromIngressHost,
} from "../src/tenant/resolve-public-tenant-label-from-host";

describe("resolve-public-tenant-label-from-host.spec.ts", () => {
  it("API-PUBLIC-HOST-01 resolves subdomain label", () => {
    const result = resolvePublicTenantLabelFromIngressHost("denali.localhost", {
      rootDomain: "localhost",
      env: {},
    });
    assert.deepEqual(result, { kind: "label", label: "denali", source: "subdomain" });
  });

  it("API-PUBLIC-HOST-02 raw IP unknown without fallback env", () => {
    const result = resolvePublicTenantLabelFromIngressHost("89.45.89.206", {
      rootDomain: "localhost",
      env: {},
    });
    assert.equal(result.kind, "unknown");
  });

  it("API-PUBLIC-HOST-03 raw IP uses PUBLIC_TENANT_FALLBACK_LABEL when host allowlisted", () => {
    const result = resolvePublicTenantLabelFromIngressHost("89.45.89.206", {
      rootDomain: "localhost",
      env: {
        PUBLIC_TENANT_FALLBACK_LABEL: "denali",
        PUBLIC_TENANT_FALLBACK_HOSTS: "89.45.89.206",
      },
    });
    assert.deepEqual(result, { kind: "label", label: "denali", source: "fallback" });
  });

  it("API-PUBLIC-HOST-04 bare loopback uses fallback label without explicit host list", () => {
    const result = resolvePublicTenantLabelFromIngressHost("127.0.0.1", {
      rootDomain: "localhost",
      env: { PUBLIC_TENANT_FALLBACK_LABEL: "operator" },
    });
    assert.deepEqual(result, { kind: "label", label: "operator", source: "fallback" });
  });

  it("API-PUBLIC-HOST-05 isBarePublicIngressHost detects IPv4", () => {
    assert.equal(isBarePublicIngressHost("89.45.89.206"), true);
    assert.equal(isBarePublicIngressHost("denali.localhost"), false);
  });
});
