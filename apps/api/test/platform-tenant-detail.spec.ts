import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("toPlatformTenantDetailDto", () => {
  it("detail dto module includes sites and ownerInvite", () => {
    const source = readFileSync(
      new URL("../src/platform/platform-tenant-detail.dto.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /buildClubSiteUrls/);
    assert.match(source, /ownerInvite/);
    assert.match(source, /siteSurfaces/);
    assert.match(source, /workspaceCommerce/);
  });

  it("tenants get resolves workspaceCommerce", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-get.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /resolveWorkspaceCommerceConfigForTenantById/);
    assert.match(source, /workspaceCommerce/);
  });

  it("tenants get returns detail shape", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-get.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /toPlatformTenantDetailDto/);
    assert.match(source, /findOwnerInviteSummary/);
  });
});
