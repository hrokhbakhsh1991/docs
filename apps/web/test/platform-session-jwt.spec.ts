import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validatePlatformSessionToken } from "../src/platform/validate-platform-session-token";

describe("platform-session-jwt.spec.ts", () => {
  it("rejects legacy JSON cookie", async () => {
    const legacy = encodeURIComponent(JSON.stringify({ phone: "+1", role: "owner" }));
    const result = await validatePlatformSessionToken(legacy);
    assert.equal(result.status, "invalid_claims");
  });

  it("rejects empty token", async () => {
    assert.equal((await validatePlatformSessionToken(undefined)).status, "missing");
  });
});
