import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildIdentityBffHeadersForTenant } from "../src/auth/identity-bff-headers";

const ENV_SNAPSHOT = {
  TOUR_OPS_DEV_WORKSPACE_ID: process.env.TOUR_OPS_DEV_WORKSPACE_ID,
  NEXT_PUBLIC_DEV_WORKSPACE_ID: process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID,
};

afterEach(() => {
  if (ENV_SNAPSHOT.TOUR_OPS_DEV_WORKSPACE_ID === undefined) {
    delete process.env.TOUR_OPS_DEV_WORKSPACE_ID;
  } else {
    process.env.TOUR_OPS_DEV_WORKSPACE_ID = ENV_SNAPSHOT.TOUR_OPS_DEV_WORKSPACE_ID;
  }
  if (ENV_SNAPSHOT.NEXT_PUBLIC_DEV_WORKSPACE_ID === undefined) {
    delete process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID;
  } else {
    process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID = ENV_SNAPSHOT.NEXT_PUBLIC_DEV_WORKSPACE_ID;
  }
});

describe("portal identity BFF headers wrapper", () => {
  it("delegates common anonymous OTP header contract to session-client", () => {
    process.env.TOUR_OPS_DEV_WORKSPACE_ID = "ws-portal-test";
    delete process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID;

    const headers = buildIdentityBffHeadersForTenant("denali.portal.localhost:3003", "tenant-1");

    assert.equal(headers["x-tenant-id"], "tenant-1");
    assert.equal(headers["x-authenticated-tenant-id"], "tenant-1");
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000099");
    assert.equal(headers["x-actor-role"], "member");
    assert.equal(headers["x-membership-status"], "ACTIVE");
    assert.equal(headers["x-workspace-id"], "ws-portal-test");
    assert.equal(headers.host, "denali.portal.localhost");
  });
});
