/**
 * Post-auth soft navigation — returnUrl guard + router contract
 * Authority: docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md §5.3
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  navigateAfterAuthSessionChange,
  navigateAfterLogin,
  resolveAuthReturnPath,
} from "../src/auth/navigate-after-auth-session-change";

describe("auth-navigate-after-session.spec.ts", () => {
  it("AUTH-NAV-01 resolveAuthReturnPath accepts safe relative returnUrl", () => {
    assert.equal(resolveAuthReturnPath("returnUrl=%2Fbookings"), "/bookings");
    assert.equal(resolveAuthReturnPath(""), "/dashboard");
    assert.equal(resolveAuthReturnPath("foo=bar"), "/dashboard");
  });

  it("AUTH-NAV-02 resolveAuthReturnPath rejects open redirects", () => {
    assert.equal(resolveAuthReturnPath("returnUrl=https%3A%2F%2Fevil.test"), "/dashboard");
    assert.equal(resolveAuthReturnPath("returnUrl=%2F%2Fevil.test"), "/dashboard");
  });

  it("AUTH-NAV-03 navigateAfterAuthSessionChange calls push then refresh", () => {
    const calls: string[] = [];
    const router = {
      push: (path: string) => {
        calls.push(`push:${path}`);
      },
      refresh: () => {
        calls.push("refresh");
      },
    };
    navigateAfterAuthSessionChange(router as never, "/dashboard");
    assert.deepEqual(calls, ["push:/dashboard", "refresh"]);
  });

  it("AUTH-NAV-04 navigateAfterLogin uses full document navigation when window exists", () => {
    const originalWindow = globalThis.window;
    const assigns: string[] = [];
    (globalThis as { window?: { location: { assign: (path: string) => void } } }).window = {
      location: {
        assign: (path: string) => {
          assigns.push(path);
        },
      },
    };
    try {
      navigateAfterLogin({ push: () => {}, refresh: () => {} } as never, "returnUrl=%2Fbookings");
      assert.deepEqual(assigns, ["/bookings"]);
    } finally {
      (globalThis as { window?: typeof originalWindow }).window = originalWindow;
    }
  });
});
