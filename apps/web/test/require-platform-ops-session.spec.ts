import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
