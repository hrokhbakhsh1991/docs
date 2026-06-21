import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformMotherHost } from "../src/platform/is-platform-mother-host";

describe("isPlatformMotherHost", () => {
  it("apex production root", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "app-tour.ir";
    try {
      assert.equal(isPlatformMotherHost("app-tour.ir"), true);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("www alias", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "app-tour.ir";
    try {
      assert.equal(isPlatformMotherHost("www.app-tour.ir"), true);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("club subdomain is not mother", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    try {
      assert.equal(isPlatformMotherHost("denali.localhost:3002"), false);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("admin host is not mother", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    try {
      assert.equal(isPlatformMotherHost("admin.localhost"), false);
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });
});
