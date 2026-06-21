import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformValidation } from "../src/platform/platform.errors.ts";
import { parseCreatePlatformTenantBody } from "../src/platform/create-platform-tenant.schema.ts";

describe("createPlatformTenantBodySchema", () => {
  it("valid parses", () => {
    const body = parseCreatePlatformTenantBody({
      subdomain: "my-club",
      workspaceType: "denali",
      ownerPhone: "+989121234567",
      displayName: "My Club",
    });
    assert.equal(body.subdomain, "my-club");
    assert.equal(body.workspaceType, "denali");
    assert.equal(body.ownerPhone, "+989121234567");
  });

  it("missing ownerPhone fails", () => {
    assert.throws(
      () =>
        parseCreatePlatformTenantBody({
          subdomain: "my-club",
          workspaceType: "denali",
        }),
      PlatformValidation
    );
  });

  it("bad subdomain fails", () => {
    assert.throws(
      () =>
        parseCreatePlatformTenantBody({
          subdomain: "Bad_Subdomain",
          workspaceType: "denali",
          ownerPhone: "+989121234567",
        }),
      PlatformValidation
    );
  });
});
