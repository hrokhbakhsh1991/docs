import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseUpdatePlatformTenantStatusBody } from "../src/platform/update-platform-tenant-status.schema.ts";

describe("platform tenant status patch", () => {
  it("validates status enum", () => {
    assert.throws(() => parseUpdatePlatformTenantStatusBody({ status: "deleted" }));
    assert.equal(parseUpdatePlatformTenantStatusBody({ status: "suspended" }).status, "suspended");
  });

  it("handler requires auth", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-status-patch.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /assertPlatformOpsAuth/);
    assert.match(source, /updatePlatformTenantStatus/);
  });

  it("registrar wires PATCH status", () => {
    const source = readFileSync(
      new URL("../src/http/platform-route-registrar.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /handlePlatformTenantsStatusPatch/);
    assert.match(source, /\/status/);
  });
});
