import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveRequestHost } from "../src/auth/resolve-request-host";

describe("resolve-request-host.spec.ts", () => {
  it("prefers x-forwarded-host over host for BFF tenant resolution", () => {
    const req = new Request("http://127.0.0.1/api/auth/request-otp", {
      headers: {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "operator.admin.localhost:3000",
      },
    });
    assert.equal(resolveRequestHost(req), "operator.admin.localhost:3000");
  });

  it("falls back to host when x-forwarded-host is absent", () => {
    const req = new Request("http://operator.admin.localhost:3000/api/auth/request-otp", {
      headers: {
        host: "operator.admin.localhost:3000",
      },
    });
    assert.equal(resolveRequestHost(req), "operator.admin.localhost:3000");
  });
});
