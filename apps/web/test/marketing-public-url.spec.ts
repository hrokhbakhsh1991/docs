import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveMarketingPublicBaseUrl,
  resolveMarketingTourDetailUrl,
  resolveMarketingToursUrl,
} from "../src/marketing/resolve-marketing-public-url";

describe("resolve-marketing-public-url", () => {
  it("WEB-MKT-01 dev host maps to shop subdomain on marketing port", () => {
    assert.equal(
      resolveMarketingPublicBaseUrl("urban.localhost:3000"),
      "http://shop.urban.localhost:3002"
    );
  });

  it("WEB-MKT-02 tour detail path", () => {
    assert.equal(
      resolveMarketingTourDetailUrl("urban.localhost:3000", "tour-1"),
      "http://shop.urban.localhost:3002/tours/tour-1"
    );
  });

  it("WEB-MKT-03 tours list with cursor", () => {
    assert.equal(
      resolveMarketingToursUrl("urban.localhost:3000", "cursor-1"),
      "http://shop.urban.localhost:3002/tours?cursor=cursor-1"
    );
  });

  it("WEB-MKT-04 MARKETING_PUBLIC_BASE_URL override", () => {
    const prior = process.env.MARKETING_PUBLIC_BASE_URL;
    process.env.MARKETING_PUBLIC_BASE_URL = "https://shop.example.com";
    try {
      assert.equal(resolveMarketingToursUrl("urban.localhost:3000"), "https://shop.example.com/tours");
    } finally {
      if (prior === undefined) {
        delete process.env.MARKETING_PUBLIC_BASE_URL;
      } else {
        process.env.MARKETING_PUBLIC_BASE_URL = prior;
      }
    }
  });
});
