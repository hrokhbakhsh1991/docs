/**
 * P4-B — portal public-auth BFF coded errors
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-09)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("portal-public-auth-bff (P4-B PR-09)", () => {
  it("PR-09a phone-preflight empty phone returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/public-auth/phone-preflight/route");
    const res = await POST(
      new Request("http://denali.portal.localhost:3003/api/public-auth/phone-preflight", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "denali.portal.localhost:3003",
        },
        body: JSON.stringify({ phone: "" }),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
  });

  it("PR-09b request-otp empty body returns MOBILE_REQUIRED", async () => {
    const { POST } = await import("../app/api/public-auth/request-otp/route");
    const res = await POST(
      new Request("http://denali.portal.localhost:3003/api/public-auth/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "denali.portal.localhost:3003",
        },
        body: JSON.stringify({}),
      })
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "MOBILE_REQUIRED");
  });
});
