/**
 * P4-B — web → portal registration redirect
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-05 / PTL-03)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationRedirectUrl,
} from "../src/portal/resolve-portal-registration-redirect";

describe("portal-registration-redirect", () => {
  it("PR-05 / PTL-03 web host maps to portal registration URL", () => {
    assert.equal(
      resolvePortalPublicBaseUrl("operator.localhost:3000"),
      "http://portal.operator.localhost:3003"
    );
    assert.equal(
      resolvePortalRegistrationRedirectUrl("operator.localhost:3000", "tour-abc"),
      "http://portal.operator.localhost:3003/catalog/tour-abc/register"
    );
  });
});
