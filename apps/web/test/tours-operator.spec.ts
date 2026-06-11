/**
 * Phase 9.3 — tours operator surface
 * Authority: docs/phase-9/subphases/9.3-tours-operator.md · DEC-P9-007 · INV-P9-007
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_WIZARD_PATH,
  requireOperatorSessionWeb,
} from "../src/admin/require-operator-session";
import { OPERATOR_NAV_TEST_IDS } from "../src/admin/shell/operator-nav.types";

const ownerSession = {
  userId: "00000000-0000-4000-8000-000000000101",
  tenantId: "00000000-0000-4000-8000-000000000014",
  role: "owner" as const,
  workspaceType: "denali",
};

describe("tours-operator.spec.ts — Phase 9.3", () => {
  it("WEB-9.3-01 tour list requires operator session", () => {
    const anonymous = requireOperatorSessionWeb({ session: null, pathname: "/tours" });
    assert.equal(anonymous.allowed, false);
    assert.match(anonymous.redirectTo, /^\/auth\/login\?returnUrl=/);

    const authenticated = requireOperatorSessionWeb({ session: ownerSession, pathname: "/tours" });
    assert.equal(authenticated.allowed, true);
  });

  it("WEB-9.3-02 wizard link targets /tours/new not (app)/tours/new", () => {
    assert.equal(OPERATOR_WIZARD_PATH, "/tours/new");
    assert.doesNotMatch(OPERATOR_WIZARD_PATH, /\(app\)/);
    assert.equal(OPERATOR_NAV_TEST_IDS.newTourCta, "operator-new-tour-cta");
    assert.doesNotMatch("/tours/new", /\(app\)\/tours\/new/);
  });
});
