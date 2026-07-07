import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildClubSiteUrls } from "../src/platform/build-club-site-urls.ts";

describe("P1-N-042: buildClubSiteUrls", () => {
  const originalDomain = process.env.PLATFORM_ROOT_DOMAIN;

  before(() => {
    process.env.PLATFORM_ROOT_DOMAIN = "example.com";
  });

  after(() => {
    if (originalDomain === undefined) {
      delete process.env.PLATFORM_ROOT_DOMAIN;
    } else {
      process.env.PLATFORM_ROOT_DOMAIN = originalDomain;
    }
  });

  it("should generate marketing URL at apex domain", () => {
    const urls = buildClubSiteUrls("my-club");
    assert.strictEqual(urls.marketing, "https://my-club.example.com");
  });

  it("should generate portal URL with .portal. subdomain", () => {
    const urls = buildClubSiteUrls("my-club");
    assert.strictEqual(urls.portal, "https://my-club.portal.example.com");
  });

  it("should generate admin URL with .admin. subdomain and /auth/login path", () => {
    const urls = buildClubSiteUrls("my-club");
    assert.strictEqual(urls.admin, "https://my-club.admin.example.com/auth/login");
  });
});

// Made with Bob
