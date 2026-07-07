import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPlatformAdminUrl } from "../src/platform/build-platform-admin-url";

describe("buildPlatformAdminUrl", () => {
  it("uses production root domain", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "app-tour.ir";
    try {
      assert.equal(buildPlatformAdminUrl(), "https://admin.app-tour.ir");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("defaults to localhost", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    delete process.env.PLATFORM_ROOT_DOMAIN;
    try {
      assert.equal(buildPlatformAdminUrl(), "https://admin.localhost");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });
});
