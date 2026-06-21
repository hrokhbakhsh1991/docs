import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformMotherHost } from "../src/platform/is-platform-mother-host";

describe("platform mother club unchanged", () => {
  it("club subdomain is not mother on localhost", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    try {
      assert.equal(isPlatformMotherHost("denali.localhost:3002"), false);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("apex localhost is mother for dev", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    try {
      assert.equal(isPlatformMotherHost("localhost:3002"), true);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });
});
