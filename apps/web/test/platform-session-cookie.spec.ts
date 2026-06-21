import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";
import { PLATFORM_SESSION_COOKIE } from "../src/platform/build-platform-session-cookie";
import { requirePlatformOpsSessionWeb } from "../src/platform/require-platform-ops-session";

describe("requirePlatformOpsSessionWeb", () => {
  it("no session redirect", () => {
    const result = requirePlatformOpsSessionWeb({
      session: null,
      pathname: "/platform/clubs",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.redirectTo, /\/auth\/login\?returnUrl=/);
    }
  });

  it("session allowed", () => {
    const result = requirePlatformOpsSessionWeb({
      session: { phone: "+989121234567", role: "owner" },
      pathname: "/platform",
    });
    assert.equal(result.allowed, true);
  });
});

describe("platform session cookie", () => {
  it("name platform_session", () => {
    assert.equal(PLATFORM_SESSION_COOKIE, "platform_session");
  });

  it("!=session", () => {
    assert.notEqual(PLATFORM_SESSION_COOKIE, SESSION_TOKEN_COOKIE);
  });
});
