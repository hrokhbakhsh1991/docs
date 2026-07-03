import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevMarketingPublicBaseUrl } from "../src/host/build-dev-marketing-public-base-url";

describe("buildDevMarketingPublicBaseUrl", () => {
  it("WRS-MKT-01 maps club apex admin host to club marketing origin", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "urban.localhost:3000",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://urban.localhost:3002"
    );
  });

  it("WRS-MKT-02 maps club portal host to club marketing apex (not shop.portal)", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "denali.portal.localhost:3003",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://denali.localhost:3002"
    );
  });

  it("WRS-MKT-03 maps club admin host to club marketing apex", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "denali.admin.localhost:3000",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://denali.localhost:3002"
    );
  });

  it("WRS-MKT-04 strips legacy shop ingress before mapping", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "shop.operator.localhost:3002",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://operator.localhost:3002"
    );
  });

  it("WRS-MKT-05 honors MARKETING_PUBLIC_BASE_URL override via configuredBaseUrl", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "denali.portal.localhost:3003",
        rootDomain: "localhost",
        marketingPort: "3002",
        configuredBaseUrl: "https://denali.club",
      }),
      "https://denali.club"
    );
  });

  it("WRS-MKT-06 never emits shop prefix on egress", () => {
    const url = buildDevMarketingPublicBaseUrl({
      ingressHost: "operator.portal.localhost:3003",
      rootDomain: "localhost",
      marketingPort: "3002",
    });
    assert.equal(url, "http://operator.localhost:3002");
    assert.equal(url.includes("shop."), false);
  });
});
