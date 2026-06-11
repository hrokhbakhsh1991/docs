/**
 * Marketing cover image host allowlist (M14)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMarketingImageRemotePatterns,
  isMarketingCatalogImageOptimizable,
  parseMarketingImageRemoteHosts,
} from "../src/catalog/resolve-marketing-image-hosts";

describe("parseMarketingImageRemoteHosts", () => {
  it("MKT-22 parses comma-separated hosts with optional port", () => {
    assert.deepEqual(parseMarketingImageRemoteHosts("127.0.0.1:9002, cdn.example.com"), [
      { hostname: "127.0.0.1", port: "9002" },
      { hostname: "cdn.example.com" },
    ]);
  });

  it("MKT-23 empty env yields no hosts", () => {
    assert.deepEqual(parseMarketingImageRemoteHosts(undefined), []);
  });
});

describe("buildMarketingImageRemotePatterns", () => {
  it("MKT-24 emits http and https patterns per host", () => {
    const patterns = buildMarketingImageRemotePatterns("cdn.example.com");
    assert.equal(patterns.length, 2);
    assert.ok(patterns.some((pattern) => pattern.protocol === "http"));
    assert.ok(patterns.some((pattern) => pattern.protocol === "https"));
  });
});

describe("isMarketingCatalogImageOptimizable", () => {
  it("MKT-25 optimizes when host matches allowlist", () => {
    const prevHosts = process.env.MARKETING_IMAGE_REMOTE_HOSTS;
    const prevForce = process.env.MARKETING_IMAGES_FORCE_UNOPTIMIZED;
    process.env.MARKETING_IMAGE_REMOTE_HOSTS = "cdn.example.com";
    delete process.env.MARKETING_IMAGES_FORCE_UNOPTIMIZED;
    try {
      assert.equal(
        isMarketingCatalogImageOptimizable("https://cdn.example.com/tours/cover.jpg"),
        true
      );
    } finally {
      if (prevHosts !== undefined) process.env.MARKETING_IMAGE_REMOTE_HOSTS = prevHosts;
      else delete process.env.MARKETING_IMAGE_REMOTE_HOSTS;
      if (prevForce !== undefined) process.env.MARKETING_IMAGES_FORCE_UNOPTIMIZED = prevForce;
    }
  });

  it("MKT-26 unknown host stays unoptimized", () => {
    const prevHosts = process.env.MARKETING_IMAGE_REMOTE_HOSTS;
    process.env.MARKETING_IMAGE_REMOTE_HOSTS = "cdn.example.com";
    try {
      assert.equal(
        isMarketingCatalogImageOptimizable("https://other.example.com/cover.jpg"),
        false
      );
    } finally {
      if (prevHosts !== undefined) process.env.MARKETING_IMAGE_REMOTE_HOSTS = prevHosts;
      else delete process.env.MARKETING_IMAGE_REMOTE_HOSTS;
    }
  });
});
