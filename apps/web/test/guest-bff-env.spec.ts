import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("web env — PSC-1b", () => {
  it("WEB-PSC-1b-02 assertGuestBffProductionConfig fails without JWT in production", async () => {
    const { assertGuestBffProductionConfig } = await import("../src/urban/urban-api-base");
    const priorNode = process.env.NODE_ENV;
    const priorUrl = process.env.TOUR_OPS_API_URL;
    const priorJwt = process.env.AUTH_JWT_PUBLIC_KEY;
    process.env.NODE_ENV = "production";
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:3001";
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    try {
      assert.throws(() => assertGuestBffProductionConfig(), /AUTH_JWT_PUBLIC_KEY_NOT_CONFIGURED/);
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorUrl === undefined) delete process.env.TOUR_OPS_API_URL;
      else process.env.TOUR_OPS_API_URL = priorUrl;
      if (priorJwt === undefined) delete process.env.AUTH_JWT_PUBLIC_KEY;
      else process.env.AUTH_JWT_PUBLIC_KEY = priorJwt;
    }
  });
});
