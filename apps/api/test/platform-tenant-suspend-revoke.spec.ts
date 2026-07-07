import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform tenant suspend revoke", () => {
  it("updatePlatformTenantStatus bumps userTenant sessionVersion on suspend", () => {
    const source = readFileSync(
      new URL("../src/platform/platform-tenant-lifecycle.service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
    assert.match(source, /input\.status === "suspended"/);
  });

  it("hydrateMembershipFromDb checks tenant active", () => {
    const source = readFileSync(
      new URL("../src/identity/hydrate-membership.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /assertTenantActiveForOperatorLogin/);
  });
});
