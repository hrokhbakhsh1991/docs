import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel";

import { normalizeHostHeader, readPlatformRootDomainWeb } from "../src/tenant/platform-host-env";

describe("platform-host-env + tenant-kernel", () => {
  it("alborz.admin.localhost parsed", () => {
    const outcome = parseMultiLevelTenantHost(
      normalizeHostHeader("alborz.admin.localhost:3000"),
      readPlatformRootDomainWeb(),
      new Set()
    );
    assert.deepEqual(outcome, { kind: "club_admin", subdomain: "alborz" });
  });
});
