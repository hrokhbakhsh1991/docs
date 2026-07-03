import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveMarketingPublicBaseUrl,
  resolveMarketingTourDetailUrl,
} from "../src/resolve-marketing-public-base-url";

describe("resolve-marketing-public-base-url", () => {
  it("WRS-GSH-01 portal ingress maps to club marketing apex", () => {
    assert.equal(
      resolveMarketingPublicBaseUrl("denali.portal.localhost:3003"),
      "http://denali.localhost:3002"
    );
  });

  it("WRS-GSH-02 never emits shop on egress", () => {
    const url = resolveMarketingTourDetailUrl("operator.admin.localhost:3000", "t1");
    assert.equal(url, "http://operator.localhost:3002/tours/t1");
    assert.equal(url.includes("shop."), false);
  });
});
