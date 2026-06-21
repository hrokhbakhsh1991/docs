/**
 * P4-B — portal catalog registrations BFF
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-10)
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

describe("portal-catalog-registrations-bff (P4-B PR-10)", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.TOUR_OPS_API_URL = "http://api.test";
  });

  afterEach(() => {
    delete process.env.TOUR_OPS_API_URL;
    delete process.env.NODE_ENV;
    delete process.env.ALLOW_DEV_WEB_SESSION;
  });

  it("PR-10a returns INVALID_PAYLOAD when required fields missing", async () => {
    const { POST } = await import("../app/api/catalog/registrations/route");
    const res = await POST(
      new Request("http://denali.portal.localhost:3003/api/catalog/registrations", {
        method: "POST",
        headers: {
          host: "denali.portal.localhost:3003",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tourId: "tour-1", email: "", fullName: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "INVALID_PAYLOAD");
  });

  it("PR-10f returns PARTY_SIZE_INVALID when partySize missing", async () => {
    const { POST } = await import("../app/api/catalog/registrations/route");
    const res = await POST(
      new Request("http://denali.portal.localhost:3003/api/catalog/registrations", {
        method: "POST",
        headers: {
          host: "denali.portal.localhost:3003",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tourId: "tour-1",
          email: "guest@example.com",
          fullName: "Portal Guest",
        }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "PARTY_SIZE_INVALID");
  });
});
