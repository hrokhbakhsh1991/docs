import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform owner invite resend", () => {
  it("route handler exists", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-owner-invite-post.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /resendPlatformTenantOwnerInvite/);
    assert.match(source, /JSON\.stringify\(\{ invite \}\)/);
  });

  it("registrar wires POST owner-invite", () => {
    const source = readFileSync(
      new URL("../src/http/platform-route-registrar.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /owner-invite/);
    assert.match(source, /handlePlatformTenantsOwnerInvitePost/);
  });
});
