import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOperatorAuthBffFetchInit,
  buildOperatorAuthBffUrl,
  fetchOperatorAuthBff,
  OPERATOR_AUTH_BFF_FETCH_TIMEOUT_MS,
} from "../src/auth/operator-auth-bff-fetch";

describe("operator-auth-bff-fetch", () => {
  it("AUTH-BFF-FETCH-01 installs a timeout signal by default", () => {
    const init = buildOperatorAuthBffFetchInit({ method: "POST" });
    assert.equal(init.cache, "no-store");
    assert.equal(init.method, "POST");
    assert.ok(init.signal instanceof AbortSignal);
  });

  it("AUTH-BFF-FETCH-02 preserves a caller-provided signal", () => {
    const controller = new AbortController();
    const init = buildOperatorAuthBffFetchInit({ signal: controller.signal });
    assert.equal(init.signal, controller.signal);
  });

  it("AUTH-BFF-FETCH-03 resolves upstream URL from shared guest BFF base", () => {
    const snapshot = {
      API_INTERNAL_URL: process.env.API_INTERNAL_URL,
      TOUR_OPS_API_URL: process.env.TOUR_OPS_API_URL,
      API_BASE_URL: process.env.API_BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
    process.env.API_INTERNAL_URL = "http://127.0.0.1:3001";
    delete process.env.TOUR_OPS_API_URL;
    delete process.env.API_BASE_URL;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        buildOperatorAuthBffUrl("/auth/request-otp"),
        "http://127.0.0.1:3001/auth/request-otp"
      );
    } finally {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("AUTH-BFF-FETCH-04 fetch bridge forwards timeout-wrapped init", async () => {
    const snapshot = {
      API_INTERNAL_URL: process.env.API_INTERNAL_URL,
      TOUR_OPS_API_URL: process.env.TOUR_OPS_API_URL,
      API_BASE_URL: process.env.API_BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
    };
    process.env.API_INTERNAL_URL = "http://127.0.0.1:3001";
    delete process.env.TOUR_OPS_API_URL;
    delete process.env.API_BASE_URL;
    process.env.NODE_ENV = "development";

    const originalFetch = globalThis.fetch;
    try {
      let capturedUrl = "";
      let capturedSignal: AbortSignal | null = null;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = typeof input === "string" ? input : String(input);
        capturedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      const response = await fetchOperatorAuthBff("/auth/phone-preflight", { method: "POST" });
      assert.equal(response.status, 200);
      assert.equal(capturedUrl, "http://127.0.0.1:3001/auth/phone-preflight");
      assert.ok(capturedSignal, "expected fetchOperatorAuthBff to install AbortSignal.timeout");
      assert.equal(OPERATOR_AUTH_BFF_FETCH_TIMEOUT_MS, 10_000);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
