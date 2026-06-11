/**
 * Phase 9.1 — web login access scaffold
 * Authority: docs/phase-9/appendices/CANLOAD-OPERATOR-SESSION.contract.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_LOGIN_PATH,
  requireOperatorSessionWeb,
} from "../src/admin/require-operator-session";

describe("auth-login-access.spec.ts — Phase 9.1", () => {
  it("WEB-9.1-01 anonymous (app)/dashboard redirects to login with returnUrl", () => {
    const result = requireOperatorSessionWeb({
      session: null,
      pathname: "/dashboard",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.redirectTo, new RegExp(`^${OPERATOR_LOGIN_PATH}\\?returnUrl=`));
    }
  });

  it("WEB-9.1-02 admin session denied owner panel redirect", () => {
    const result = requireOperatorSessionWeb({
      session: {
        userId: "00000000-0000-4000-8000-000000000103",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "admin",
        workspaceType: "denali",
      },
      pathname: "/dashboard",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.redirectTo, /access=owner-only/);
    }
  });
});
