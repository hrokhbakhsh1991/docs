import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchPublicTenantContextForHost,
  isDevGuestHostAllowed,
  resolvePublicBrandingHost,
  resolveTenantIdFromDevHost,
  resolveTenantIdFromIngressLabel,
} from "../src/index";

describe("guest-surface-host", () => {
  it("resolvePublicBrandingHost strips shop prefix", () => {
    assert.equal(resolvePublicBrandingHost("shop.operator.localhost:3002"), "operator.localhost");
  });

  it("resolveTenantIdFromIngressLabel maps operator label", () => {
    assert.equal(
      resolveTenantIdFromIngressLabel("operator"),
      "00000000-0000-4000-8000-000000000014"
    );
  });

  it("resolveTenantIdFromDevHost marketing shop host", () => {
    const prev = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("shop.operator.localhost", "marketing"),
        "00000000-0000-4000-8000-000000000014"
      );
      assert.equal(
        resolveTenantIdFromDevHost("operator.portal.localhost", "portal"),
        "00000000-0000-4000-8000-000000000014"
      );
    } finally {
      if (prev === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = prev;
    }
  });

  it("isDevGuestHostAllowed false in production", () => {
    const prevNode = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(isDevGuestHostAllowed(), false);
    } finally {
      process.env.NODE_ENV = prevNode;
      if (prevAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = prevAllow;
    }
  });

  it("resolveDevPluginIdForTenantId uses UUID map not hostname", async () => {
    const { resolveDevPluginIdForTenantId, DevPluginIdUnresolvedError } = await import(
      "../src/resolve-dev-plugin-id"
    );
    assert.equal(resolveDevPluginIdForTenantId("00000000-0000-4000-8000-000000000014"), "denali");
    assert.equal(resolveDevPluginIdForTenantId("00000000-0000-4000-8000-000000000004"), "urban");
    assert.throws(
      () => resolveDevPluginIdForTenantId("00000000-0000-4000-8000-000000000099"),
      DevPluginIdUnresolvedError
    );
  });

  it("fetchPublicTenantContextForHost calls onBeforeFetch", async () => {
    let called = false;
    const result = await fetchPublicTenantContextForHost("operator.localhost", {
      apiBaseUrl: "http://127.0.0.1:59999",
      onBeforeFetch: () => {
        called = true;
      },
    });
    assert.equal(called, true);
    assert.equal(result, null);
  });
});
