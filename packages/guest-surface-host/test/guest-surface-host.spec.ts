import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchPublicTenantContextForHost,
  isDevGuestHostAllowed,
  PHASE_43_HOST_TENANT_IDS,
  resolveMemberLoginCatalogTourId,
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

  it("B.19b smoke hosts are canonical; dual-key urban-owner/member removed", () => {
    const smokeUuid = "00000000-0000-4000-8000-000000000004";
    assert.equal(resolveTenantIdFromIngressLabel("workspace-owner-smoke"), smokeUuid);
    assert.equal(resolveTenantIdFromIngressLabel("workspace-member-smoke"), smokeUuid);
    assert.equal(resolveTenantIdFromIngressLabel("urban-owner"), null);
    assert.equal(resolveTenantIdFromIngressLabel("urban-member"), null);
    assert.equal(Object.hasOwn(PHASE_43_HOST_TENANT_IDS, "urban-owner"), false);
    assert.equal(Object.hasOwn(PHASE_43_HOST_TENANT_IDS, "urban-member"), false);
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
    const { resolveDevPluginIdForTenantId, DevPluginIdUnresolvedError } =
      await import("../src/resolve-dev-plugin-id");
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

  it("resolveMemberLoginCatalogTourId does not silently fall back to operator tour for unknown plugins", () => {
    const prevLoginTour = process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
    const prevDevTour = process.env.PORTAL_DEV_GUEST_TOUR_ID;
    delete process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
    delete process.env.PORTAL_DEV_GUEST_TOUR_ID;
    try {
      assert.equal(
        resolveMemberLoginCatalogTourId("denali"),
        "00000000-0000-4000-8000-000000000220"
      );
      assert.throws(
        () => resolveMemberLoginCatalogTourId("alpine"),
        /MEMBER_LOGIN_CATALOG_TOUR_ID_UNRESOLVED/
      );
      process.env.PORTAL_MEMBER_LOGIN_TOUR_ID = " tour-env ";
      assert.equal(resolveMemberLoginCatalogTourId("alpine"), "tour-env");
    } finally {
      if (prevLoginTour === undefined) {
        delete process.env.PORTAL_MEMBER_LOGIN_TOUR_ID;
      } else {
        process.env.PORTAL_MEMBER_LOGIN_TOUR_ID = prevLoginTour;
      }
      if (prevDevTour === undefined) {
        delete process.env.PORTAL_DEV_GUEST_TOUR_ID;
      } else {
        process.env.PORTAL_DEV_GUEST_TOUR_ID = prevDevTour;
      }
    }
  });
});
