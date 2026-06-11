import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationRedirectUrl,
} from "../src/portal/resolve-portal-registration-redirect";

describe("portal-registration-redirect", () => {
  it("PTL-03 web host maps to portal registration URL", () => {
    assert.equal(resolvePortalPublicBaseUrl("operator.localhost:3000"), "http://operator.localhost:3003");
    assert.equal(
      resolvePortalRegistrationRedirectUrl("operator.localhost:3000", "tour-abc"),
      "http://operator.localhost:3003/catalog/tour-abc/register"
    );
  });
});
