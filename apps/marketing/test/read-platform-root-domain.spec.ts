import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readPlatformRootDomainMarketing } from "../src/platform/read-platform-root-domain";

describe("readPlatformRootDomainMarketing", () => {
  it("uses PLATFORM_ROOT_DOMAIN when set", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "Example.COM";
    try {
      assert.equal(readPlatformRootDomainMarketing(), "example.com");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("defaults to localhost when unset", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    delete process.env.PLATFORM_ROOT_DOMAIN;
    try {
      assert.equal(readPlatformRootDomainMarketing(), "localhost");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });
});
