import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCreateTenantResponse } from "../src/platform/create-tenant-response.dto.ts";

describe("toCreateTenantResponse", () => {
  it("3 top keys or dev hint", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    const response = toCreateTenantResponse({
      tenant: {
        id: "00000000-0000-4000-8000-000000000099",
        subdomain: "my-club",
        workspaceType: "denali",
      },
      sites: {
        marketing: "https://my-club.example.com",
        portal: "https://my-club.portal.example.com",
        admin: "https://my-club.admin.example.com/auth/login",
      },
      invite: {
        inviteId: "inv-1",
        inviteToken: "tok-1",
      },
    });

    assert.deepEqual(Object.keys(response).sort(), ["devHostHint", "invite", "sites", "tenant"]);
  });

  it("sites 3 urls", () => {
    const response = toCreateTenantResponse({
      tenant: {
        id: "00000000-0000-4000-8000-000000000099",
        subdomain: "my-club",
        workspaceType: "denali",
      },
      sites: {
        marketing: "https://my-club.example.com",
        portal: "https://my-club.portal.example.com",
        admin: "https://my-club.admin.example.com/auth/login",
      },
      invite: {
        inviteId: "inv-1",
        inviteToken: "tok-1",
      },
    });

    assert.equal(Object.keys(response.sites).length, 3);
    assert.match(response.sites.marketing, /^https:\/\//);
    assert.match(response.sites.portal, /portal/);
    assert.match(response.sites.admin, /admin/);
  });

  it("devHostHint for localhost", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    const response = toCreateTenantResponse({
      tenant: {
        id: "00000000-0000-4000-8000-000000000099",
        subdomain: "my-club",
        workspaceType: "denali",
      },
      sites: {
        marketing: "https://my-club.localhost",
        portal: "https://my-club.portal.localhost",
        admin: "https://my-club.admin.localhost/auth/login",
      },
      invite: {
        inviteId: "inv-1",
        inviteToken: "tok-1",
      },
    });
    assert.equal(response.devHostHint?.adminHost, "my-club.admin.localhost");
    assert.match(response.devHostHint?.marketingHost ?? "", /my-club\.localhost/);
  });
});
