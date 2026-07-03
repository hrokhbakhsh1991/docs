import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePortalIngressHost } from "../src/tenant/resolve-portal-ingress-host";

describe("resolvePortalIngressHost", () => {
  it("prefers x-forwarded-host over loopback Host for BFF self-fetch", () => {
    const req = new Request("http://127.0.0.1:3003/api/me/profile", {
      headers: {
        host: "127.0.0.1:3003",
        "x-forwarded-host": "portal.denali.club:3003",
      },
    });
    assert.equal(resolvePortalIngressHost(req), "portal.denali.club:3003");
  });

  it("falls back to Host when forwarded header absent", () => {
    const req = new Request("http://operator.portal.localhost:3003/api/me/profile", {
      headers: { host: "operator.portal.localhost:3003" },
    });
    assert.equal(resolvePortalIngressHost(req), "operator.portal.localhost:3003");
  });

  it("resolvePortalIngressHostFromHeaders mirrors Request resolution", async () => {
    const { resolvePortalIngressHostFromHeaders } = await import(
      "../src/tenant/resolve-portal-ingress-host.js"
    );
    const headers = {
      get(name: string) {
        if (name === "x-forwarded-host") {
          return "portal.denali.club:3003";
        }
        if (name === "host") {
          return "127.0.0.1:3003";
        }
        return null;
      },
    };
    assert.equal(
      resolvePortalIngressHostFromHeaders(headers),
      "portal.denali.club:3003"
    );
  });
});
