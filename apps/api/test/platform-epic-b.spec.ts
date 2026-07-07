import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { toCreateTenantResponse } from "../src/platform/create-tenant-response.dto.ts";
import { parseCreatePlatformTenantBody } from "../src/platform/create-platform-tenant.schema.ts";

describe("platform EPIC B gate", () => {
  it("provision flow assertions", () => {
    const body = parseCreatePlatformTenantBody({
      subdomain: "epic-b-club",
      workspaceType: "denali",
      ownerPhone: "+989121234567",
    });
    assert.equal(body.subdomain, "epic-b-club");

    const response = toCreateTenantResponse({
      tenant: {
        id: "00000000-0000-4000-8000-000000000099",
        subdomain: body.subdomain,
        workspaceType: body.workspaceType,
      },
      sites: {
        marketing: "https://epic-b-club.example.com",
        portal: "https://epic-b-club.portal.example.com",
        admin: "https://epic-b-club.admin.example.com/auth/login",
      },
      invite: { inviteId: "inv-1", inviteToken: "tok-1" },
    });
    assert.equal(response.tenant.subdomain, "epic-b-club");
    assert.ok(response.invite.inviteToken);

    const sagaSource = readFileSync(new URL("../src/platform/provision-tenant-saga.ts", import.meta.url), "utf8");
    assert.match(sagaSource, /invalidateTenantRegistryCache/);
    assert.match(sagaSource, /seedWorkspaceWizardTemplateInTransaction/);
    assert.match(sagaSource, /assertProductionCertifiedWorkspaceType/);
  });
});
