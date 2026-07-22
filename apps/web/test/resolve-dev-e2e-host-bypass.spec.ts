import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldBypassMiddlewareForDevE2eHost } from "../src/tenant/resolve-dev-e2e-host-bypass";

describe("resolve-dev-e2e-host-bypass", () => {
  const env = process.env;

  it("WEB-P8-04-01 bypasses workspace smoke hosts in dev", () => {
    const prevNode = env.NODE_ENV;
    env.NODE_ENV = "development";
    try {
      assert.equal(
        shouldBypassMiddlewareForDevE2eHost("workspace-member-smoke.localhost:3000"),
        true
      );
      assert.equal(
        shouldBypassMiddlewareForDevE2eHost("workspace-owner-smoke.localhost:3000"),
        true
      );
      assert.equal(shouldBypassMiddlewareForDevE2eHost("denali.localhost:3000"), false);
    } finally {
      env.NODE_ENV = prevNode;
    }
  });

  it("WEB-P8-04-02 never bypasses in production", () => {
    const prevNode = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      assert.equal(
        shouldBypassMiddlewareForDevE2eHost("workspace-member-smoke.localhost:3000"),
        false
      );
    } finally {
      env.NODE_ENV = prevNode;
    }
  });
});
